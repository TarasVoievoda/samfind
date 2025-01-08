import { 
  Module, 
  NestModule, 
  MiddlewareConsumer,
  RequestMethod,
} from "@nestjs/common";

import { TypeOrmModule } from "@nestjs/typeorm";

import { ConfigModule } from "@nestjs/config";

import { AuthMiddleware } from "./common/middlewares/auth.middleware";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

import { AuthModule } from "./modules/auth/auth.module";
import { UserModule } from "./modules/user/user.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: "localhost",
      port: 5432,
      username: "postgres",
      password: "123456",
      database: "samfind-db",
      autoLoadEntities: true,
      synchronize: true,
    }),
    AuthModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude("users", {
        path: "/users",
        method: RequestMethod.POST,
      })
      .forRoutes("users", "license");
  }
}
