export enum UserStatus {
  Active = "active",
  Inactive = "inactive",
}

export enum UserRole {
  Admin = "admin",
  Customer = "customer",
}

export enum UserAuthType {
  Email = "email",
  Google = "google",
}

export enum UserAccountType {
  Private = "private",
  Business = "business",
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  authType: UserAuthType;
  accountType: UserAccountType;
  role: UserRole;
  status: UserStatus;
  discount: number;
  referralCode: string;
}
