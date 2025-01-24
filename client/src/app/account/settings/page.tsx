"use client";

import React, { useContext, useEffect, useState } from "react";

import { AuthContext } from "@/context";

import { useUpdateUser } from "@/hooks/api/user";

import { Button, Card, FullScreenLoader, Input } from "@/components";

import { UserStatus } from "@/types";
import { useToast } from "@/hooks";

import { ShieldPlus, ShieldMinus, Copy } from "lucide-react";

const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_DOMAIN;

export default function Settings() {
  const { toast } = useToast();
  const { user, userLoading } = useContext(AuthContext);

  const [userFormData, setUserFormData] = useState({
    firstName: "",
    lastName: "",
  });

  const [userPasswordFormData, setUserPasswordFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const {
    mutate: updateUserDataMutation,
    isPending: isUpdateUserPending,
    isSuccess: isUpdateUserSuccess,
  } = useUpdateUser();

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const name = event.target.name;
    const value = event.target.value;

    setUserFormData({ ...userFormData, [name]: value });
  };

  const handlePasswordFormInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const name = event.target.name;
    const value = event.target.value;

    setUserPasswordFormData({ ...userPasswordFormData, [name]: value });
  };

  const handleSaveSettingsSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (userFormData.firstName === "") {
      toast({
        description: "Some fields are empty",
      });
    }

    if (user) updateUserDataMutation({ id: user?.id, userData: userFormData });
  };

  const handleChangePasswordSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (
      userPasswordFormData.newPassword !== userPasswordFormData.confirmPassword
    ) {
      toast({
        description: "Password is not the same",
      });

      return;
    }

    if (
      userPasswordFormData.newPassword === "" ||
      userPasswordFormData.confirmPassword === ""
    ) {
      toast({
        description: "Some fields are empty",
      });

      return;
    }

    if (user) {
      updateUserDataMutation({
        id: user.id,
        userData: { password: userPasswordFormData.newPassword },
      });
    }
  };

  // const handleDeactivateAccount = () => {
  //   if (user) {
  //     if (user.status === UserStatus.Active) {
  //       updateUserDataMutation({ id: user.id, userData: { status: UserStatus.Inactive } });
  //     } else {
  //       updateUserDataMutation({ id: user.id, userData: { status: UserStatus.Active } });
  //     }

  //     // update user
  //   }
  // };

  useEffect(() => {
    if (isUpdateUserSuccess) {
      setUserPasswordFormData({ newPassword: "", confirmPassword: "" });
    }
  }, [isUpdateUserSuccess]);

  const onCopyReferralCode = () => {
    if (user) {
      const link = `${frontendUrl}/auth/sign-up?accountType=private&userReferralCode=${user.referralCode}`;

      navigator.clipboard.writeText(link);
    }

    toast({
      description: "Copied",
    });
  };

  return (
    <div className="pb-[50px] flex justify-center">
      {(isUpdateUserPending || userLoading) && <FullScreenLoader />}

      <div>
        <h2 className="text-[24px]">Settings</h2>

        <div className="flex justify-between items-center">
          <p>
            <span>Account status: </span>
            {!userLoading && (
              <span
                className={`${user?.status === UserStatus.Active ? "text-green-500" : "text-orange-400"}`}
              >
                {user?.status === UserStatus.Active ? "active" : "inactive"}
              </span>
            )}
          </p>

          <div>
            <Button variant="outline" onClick={onCopyReferralCode}>
              <Copy />
              Copy your referral code
            </Button>
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <div className="flex flex-col gap-3">
            <Card className="min-w-[360px] px-8 py-7 mt-5 rounded-2xl">
              <p className="font-semibold text-[18px]">Change your name</p>

              <form
                onSubmit={handleSaveSettingsSubmit}
                className="mt-3 flex flex-col gap-2"
              >
                <div>
                  <label htmlFor="firstName" className="text-sm">
                    First name
                  </label>
                  <Input
                    id="firstName"
                    name="firstName"
                    placeholder="Your name"
                    className="py-5 px-3"
                    value={userFormData.firstName}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="text-sm">
                    Last name
                  </label>
                  <Input
                    id="lastName"
                    name="lastName"
                    placeholder="Your last name"
                    className="py-5 px-3"
                    value={userFormData.lastName}
                    onChange={handleInputChange}
                  />
                </div>

                <Button className="mt-3 w-full py-5">Save</Button>
              </form>
            </Card>
          </div>

          <Card className="min-w-[360px] px-8 py-7 mt-5 rounded-2xl">
            <p className="font-semibold text-[18px]">Change password</p>

            <form
              onSubmit={handleChangePasswordSubmit}
              className="mt-3 flex flex-col gap-2"
            >
              <div>
                <label htmlFor="newPassword" className="text-sm">
                  New password
                </label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={userPasswordFormData.newPassword}
                  onChange={handlePasswordFormInputChange}
                  className="py-5 px-3"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="text-sm">
                  Confirm password
                </label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Confirm new password"
                  type="password"
                  value={userPasswordFormData.confirmPassword}
                  onChange={handlePasswordFormInputChange}
                  className="py-5 px-3"
                />
              </div>

              <Button className="mt-3 w-full py-5">Update</Button>
            </form>
          </Card>
        </div>

        <Card className="px-10 py-5 mt-3 rounded-2xl">
          <p className="font-semibold text-[18px]">Deactivate account</p>
          <p className="text-sm text-gray-600">
            This action will change your status
          </p>

          <Button
            variant="destructive"
            className={`${user?.status === UserStatus.Inactive && "bg-green-600 hover:bg-green-500"} mt-4`}
            // onClick={handleDeactivateAccount}
            disabled={true}
          >
            {user?.status === UserStatus.Active ? (
              <>
                <ShieldMinus size={18} />
                <span>Deactivate</span>
              </>
            ) : (
              <>
                <ShieldPlus size={18} />
                <span>Activate</span>
              </>
            )}
          </Button>
        </Card>
      </div>
    </div>
  );
}
