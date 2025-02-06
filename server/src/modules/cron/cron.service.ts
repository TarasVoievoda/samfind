import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { startOfDay, endOfDay } from "date-fns";
import { PrismaService } from "nestjs-prisma";
import { StripeService } from "../stripe/stripe.service";
import { LicenseStatus } from "@prisma/client";
import { MailService } from "../mail/mail.service";

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly mailService: MailService,
  ) {}

  @Cron("0 8 1 * *")
  //   @Cron("55 14 * * *")
  async handleFirstDayOfMonth() {
    try {
      this.logger.log(
        "Running on the 1st day of the month at 08:00 AM Create Invoices - start",
      );
      const today = new Date();
      // const today = new Date("2025-03-01");

      const subscriptions = await this.prisma.subscription.findMany({
        where: {
          nextDate: {
            gte: startOfDay(today),
            lt: endOfDay(today),
          },
          isActive: true,
        },
        include: {
          plan: true,
          user: true,
          license: {
            include: {
              _count: {
                select: { activeLicenses: true },
              },
            },
          },
        },
      });

      const subscriptionIds = subscriptions.map((sub) => sub.id);

      if (subscriptionIds.length > 0) {
        await this.prisma.subscription.updateMany({
          where: {
            id: { in: subscriptionIds },
          },
          data: {
            isInTrial: true,
          },
        });
      }

      for (let i = 0; i < subscriptions.length; i++) {
        const subscription = subscriptions[i];
        if (subscription.license._count.activeLicenses === 0) continue;

        const discount = await this.prisma.discount.findFirst({
          where: {
            userId: subscription.userId,
            stripeCouponId: null,
            used: false,
          },
        });

        let discountId = undefined;
        let discountAmount = undefined;
        if (discount) {
          discountAmount = discount.endAmount;

          if (
            discount.endAmount >
            subscription.license._count.activeLicenses * subscription.plan.price
          ) {
            discountAmount =
              subscription.license._count.activeLicenses *
              subscription.plan.price;
            await this.prisma.discount.create({
              data: {
                userId: subscription.userId,
                endAmount:
                  discount.endAmount -
                  subscription.license._count.activeLicenses *
                    subscription.plan.price,
              },
            });
          }

          const stripeDiscount =
            await this.stripeService.createCoupon(discountAmount);

          discountId = stripeDiscount.id;

          await this.prisma.discount.update({
            where: { id: discount.id },
            data: {
              stripeCouponId: discountId,
            },
          });
        }

        const metadata = {
          quantity: subscription.license._count.activeLicenses,
          subscriptionId: subscription.id,
          stripeCouponId: discountId,
          discountAmount,
        };

        await this.stripeService.createAndPayInvoice({
          customerId: subscription.user.stripeCustomerId,
          priceId: subscription.plan.stripePriceId,
          quantity: subscription.license._count.activeLicenses,
          couponId: discountId,
          description: `Plan - ${subscription.plan.type} - ${subscription.plan.period}. Quantity - ${subscription.license._count.activeLicenses}. ${discount ? `Discount: ${discount.endAmount / 100}$.` : ""}`,
          metadata,
          pay: true,
        });
      }

      this.logger.log(
        "Running on the 1st day of the month at 08:00 AM Create Invoices - end",
      );
    } catch (error) {
      this.logger.error("Error Paying Subscriptions", error);
    }
  }

  @Cron("0 8 6 * *")
  //   @Cron("40 15 * * *")
  async handleSixthDayOfMonth() {
    try {
      this.logger.log(
        "Running on the 6th day of the month at 08:00 AM Check Unpaid Subscriptions - start",
      );

      const subscriptions = await this.prisma.subscription.findMany({
        where: {
          isInTrial: true,
        },
        include: { user: true },
      });

      const subscriptionIds = subscriptions.map((sub) => sub.id);
      const licenseIds = subscriptions.map((sub) => sub.licenseId);

      if (subscriptionIds.length > 0) {
        await this.prisma.subscription.updateMany({
          where: {
            id: { in: subscriptionIds },
          },
          data: {
            isInTrial: false,
            isActive: false,
          },
        });

        await this.prisma.license.updateMany({
          where: {
            id: { in: licenseIds },
          },
          data: {
            status: LicenseStatus.inactive,
          },
        });
      }

      for (let i = 0; i < subscriptions.length; i++) {
        const subscription = subscriptions[i];
        const response = await this.stripeService.getUserInvoices(
          subscription.user.stripeCustomerId,
          1,
        );
        if (!response.data.length) continue;

        await this.mailService.sendWarningLicenseDeactivated(
          subscription.user.email,
          response.data[0].hosted_invoice_url,
        );
      }

      this.logger.log(
        "Running on the 6th day of the month at 08:00 AM Check Unpaid Subscriptions - end",
      );
    } catch (error) {
      this.logger.error("Error deactivating Subscriptions", error);
    }
  }
}
