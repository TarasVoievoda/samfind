import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import Stripe from "stripe";
import {
  LicenseTierType,
  UserAccountType,
  LicenseStatus,
  PlanPeriod,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UserService } from "../user/user.service";

import { CreateIntentDto } from "./dto/create-intent-dto";
import { addMonths, addYears, startOfMonth } from "date-fns";

interface ICreatePaymentSession {
  customerId: string;
  priceId: string;
  quantity: number;
  subscriptionId: string;
  description?: string;
  discountId?: string;
}

interface ICreateInvoiceItem {
  customerId: string;
  invoiceId: string;
  priceId: string;
  quantity: number;
  description: string;
}

interface ICreateAndPayInvoice {
  customerId: string;
  priceId: string;
  quantity: number;
  description: string;
  metadata: { [key: string]: string | number };
  couponId?: string;
  pay?: boolean;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {
    this.stripe = new Stripe(this.configService.get("STRIPE_SECRET_KEY"), {
      apiVersion: "2024-12-18.acacia",
    });
  }

  async createCustomer(email: string, name: string): Promise<Stripe.Customer> {
    return await this.stripe.customers.create({ email, name });
  }

  async createProduct(
    name: string,
    description: string,
  ): Promise<Stripe.Product> {
    return await this.stripe.products.create({ name, description });
  }

  async createPrice(productId: string, amount: number): Promise<Stripe.Price> {
    return await this.stripe.prices.create({
      unit_amount: amount,
      currency: "usd",
      product: productId,
    });
  }

  async createCoupon(amount: number): Promise<Stripe.Coupon> {
    return await this.stripe.coupons.create({
      amount_off: amount,
      currency: "usd",
      duration: "once",
    });
  }

  createPaymentSession = async ({
    customerId,
    priceId,
    quantity,
    description,
    subscriptionId,
    discountId,
  }: ICreatePaymentSession) => {
    if (discountId) {
      await this.stripe.customers.update(customerId, {
        coupon: discountId,
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity,
        },
      ],
      // allow_promotion_codes: discountId ? true : undefined,
      invoice_creation: {
        enabled: true,
        invoice_data: {
          metadata: {
            subscriptionId,
          },
        },
      },
      discounts: discountId ? [{ coupon: discountId }] : undefined,
      customer: customerId,
      mode: "payment",
      payment_intent_data: {
        setup_future_usage: "off_session",
        description,
      },
      success_url: "http://localhost:3000/",
      cancel_url: "http://localhost:3000/",
    });
    return session;
  };

  async createInvoiceItem({
    customerId,
    invoiceId,
    priceId,
    quantity,
    description,
  }: ICreateInvoiceItem): Promise<Stripe.InvoiceItem> {
    return await this.stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoiceId,
      price: priceId,
      quantity,
      description,
    });
  }

  async createAndPayInvoice({
    customerId,
    priceId,
    quantity,
    description,
    couponId,
    metadata,
    pay,
  }: ICreateAndPayInvoice) {
    const invoice = await this.stripe.invoices.create({
      customer: customerId,
      description,
      metadata,
      currency: "usd",
      collection_method: "charge_automatically",
    });

    await this.createInvoiceItem({
      customerId,
      invoiceId: invoice.id,
      priceId,
      quantity,
      description,
    });

    if (couponId)
      await this.stripe.invoices.update(invoice.id, {
        discounts: [
          {
            coupon: couponId,
          },
        ],
      });

    await this.stripe.invoices.finalizeInvoice(invoice.id);
    if (pay) {
      await this.stripe.invoices.pay(invoice.id);
    }

    const retrieveInvoice = await this.stripe.invoices.retrieve(invoice.id);

    return retrieveInvoice;
  }

  async createPaymentIntent(
    createPaymentDto: CreateIntentDto,
  ): Promise<Stripe.PaymentIntent> {
    const { userId, amount, currency, tierType, limit, userReferralCode } =
      createPaymentDto;

    const referralDiscount = amount / 10;

    let metadata: any = {
      userId,
      tierType,
      limit,
    };

    let intent = {
      amount,
      currency,
      metadata,
    };

    if (userReferralCode) {
      intent.metadata = {
        ...metadata,
        userReferralCode,
        referralDiscount,
      };
    }

    return this.stripe.paymentIntents.create(intent);
  }

  constructEvent(
    payload: any,
    sig: string | string[],
    secret: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, sig, secret);
  }

  async handleEvent(event: Stripe.Event) {
    switch (event.type) {
      case "invoice.payment_succeeded":
        const invoice = event.data.object as Stripe.Invoice;
        this.handleSuccessfulInvoicePayment(invoice);
        break;
      // case "payment_intent.succeeded":
      //   const paymentIntent = event.data.object;

      //   this.handleSuccessfulPayment(paymentIntent);
      //   break;
      // case "identity.verification_session.created":
      //   // const verificationCreated = event.data.object;
      //   break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  }

  private async handleSuccessfulInvoicePayment(invoice: Stripe.Invoice) {
    try {
      const { quantity, userReferralCode, subscriptionId, stripeCouponId } =
        invoice.metadata;

      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true, user: true },
      });

      if (!subscription) return;

      if (userReferralCode) {
        // find user and update user discount
        this.userService.findAndUpdateUserByReferralCode(
          Number(userReferralCode),
          subscription.user,
          Math.round(subscription.plan.price / 10),
        );
      }

      if (subscription.user.accountType === UserAccountType.private) {
        const license = await this.prisma.license.findUnique({
          where: { ownerId: subscription.userId },
        });

        await this.prisma.license.update({
          where: {
            id: license.id,
          },
          data: {
            limit: Number(quantity),
            tierType: subscription.plan.type,
          },
        });
      } else if (
        subscription.user.accountType === UserAccountType.business &&
        !subscription.licenseId
      ) {
        await this.prisma.license.create({
          data: {
            ownerId: subscription.userId,
            status: LicenseStatus.active,
            limit: Number(quantity),
            tierType: subscription.plan.type,
          },
        });
      }

      const nextDate =
        subscription.plan.period === PlanPeriod.monthly
          ? startOfMonth(addMonths(new Date(), 1))
          : startOfMonth(addYears(new Date(), 1));

      if (stripeCouponId) {
        await this.prisma.discount.updateMany({
          where: { stripeCouponId },
          data: {
            used: true,
          },
        });
      }
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          isActive: true,
          isInTrial: false,
          nextDate,
          stripeInvoiceIds: [...subscription.stripeInvoiceIds, invoice.id],
        },
      });

      this.logger.log(`License added for user ${subscription?.userId}`);
    } catch (error) {
      this.logger.error("Error adding license to user", error);
    }
  }

  private async handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent) {
    try {
      const { userId, limit, tierType, userReferralCode, referralDiscount } =
        paymentIntent.metadata;

      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) return;

      if (userReferralCode) {
        // find user and update user discount
        this.userService.findAndUpdateUserByReferralCode(
          Number(userReferralCode),
          user,
          Number(referralDiscount),
        );

        await this.prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            discount: user.discount + Number(referralDiscount),
            invitedReferralCode: null,
          },
        });
      }

      if (user.accountType === UserAccountType.private) {
        const license = await this.prisma.license.findUnique({
          where: { ownerId: userId },
        });

        await this.prisma.license.update({
          where: {
            id: license.id,
          },
          data: {
            limit: Number(limit),
            tierType: tierType as LicenseTierType,
          },
        });
      } else if (user.accountType === UserAccountType.business) {
        await this.prisma.license.create({
          data: {
            ownerId: userId,
            status: LicenseStatus.active,
            limit: Number(limit),
            tierType: LicenseTierType.standard,
          },
        });
      }

      this.logger.log(`License added for user ${userId}`);
    } catch (error) {
      this.logger.error("Error adding license to user", error);
    }
  }
}
