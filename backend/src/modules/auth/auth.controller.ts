import { Body, Controller, Post } from "@nestjs/common";

import { SignInDto, SignUpDto } from "./dto/auth-user-dto";
import { ResetPasswordDto } from "./dto/reset-password-dto";

import { AuthService } from "./auth.service";

import { ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: "Sign in" })
  @Post("/sign-in")
  public async signIn(@Body() signInUserDto: SignInDto) {
    return this.authService.signIn(signInUserDto);
  }

  @ApiOperation({ summary: "Sign up" })
  @Post("/sign-up")
  public async signUp(@Body() signUpUserDto: SignUpDto) {
    return this.authService.signUp(signUpUserDto);
  }

  @ApiOperation({ summary: "Send verification code for reset password" })
  @Post("/send-verification-code")
  public async sendResetPasswordCode(@Body() sendVerificationCodeDto: { email: string }) {
    return this.authService.sendResetPasswordVerificationCode(sendVerificationCodeDto.email);
  }

  @ApiOperation({ summary: "Reset password" })
  @Post("/reset-password")
  public async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
