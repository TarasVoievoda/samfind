
import { licensingOptions } from "@app/(home)/_lib";
import { LicensingOptionCard } from "./licensing-option-card";

export const LicensingOptionList = () => {
  return (
    <div className="mt-20 sm:mt-[120px] mb-20">
      <div className="mb-[40px] sm:mb-[50px] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 lg:gap-0">
        <h2 className="text-2xl lg:text-[40px] font-semibold ">
          Licensing Options
        </h2>
        <span className="font-medium text-base lg:text-xl">
          Adapt and evolve with your growing needs. Choose what <br /> works
          best for you.
        </span>
      </div>

      <div className="flex flex-col ml:flex-row gap-5">
        {licensingOptions.map((option) => (
          <LicensingOptionCard key={option.id} option={option} />
        ))}
      </div>
    </div>
  );
};

