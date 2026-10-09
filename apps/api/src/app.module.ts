import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';
import { ConfigModule } from './config/config.module';
import { APP_CONFIG, loadConfig, type AppConfig } from './config/env';
import { PrismaModule, PrismaService } from './infrastructure/prisma/prisma.service';
import { RedisModule, RedisThrottlerStorage } from './infrastructure/redis/redis.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { AuthGuard } from './common/guards/auth.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { EventPermissionGuard } from './common/guards/event-permission.guard';
import { AuditModule } from './modules/audit/audit.service';
import { AudienceModule } from './modules/audience/audience.service';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { PhoneAuthController } from './modules/auth/phone-auth.controller';
import { EmailCodeService } from './modules/auth/email-code.service';
import { WhatsAppDeliveryService } from './modules/whatsapp/whatsapp-delivery.service';
import { PhoneOtpService } from './modules/onboarding/phone-otp.service';
import { PreviewController } from './modules/onboarding/preview.controller';
import { PreviewService } from './modules/onboarding/preview.service';
import { QuickStartController } from './modules/onboarding/quick-start.controller';
import { QuickStartService } from './modules/onboarding/quick-start.service';
import { GoogleAuthService } from './modules/auth/google-auth.service';
import { MfaService } from './modules/auth/mfa.service';
import { SessionService } from './modules/auth/session.service';
import { UsersController } from './modules/users/users.controller';
import { MetaController } from './modules/meta/meta.controller';
import { HealthController } from './modules/health/health.controller';
import { EventsController } from './modules/events/events.controller';
import { EventsService } from './modules/events/events.service';
import { ShareLinkController } from './modules/events/share-link.controller';
import { ShareLinkService } from './modules/events/share-link.service';
import { FunctionsController } from './modules/functions/functions.controller';
import { FunctionsService } from './modules/functions/functions.service';
import { GroupsController } from './modules/groups/groups.controller';
import { GroupsService } from './modules/groups/groups.service';
import { GuestsController } from './modules/guests/guests.controller';
import { GuestsService } from './modules/guests/guests.service';
import { InvitationsController } from './modules/invitations/invitations.controller';
import { InvitationsService } from './modules/invitations/invitations.service';
import { InvitationTokenService } from './modules/invitations/invitation-token.service';
import { GuestInvitationController } from './modules/guest-access/guest-invitation.controller';
import { GuestInvitationService } from './modules/guest-access/guest-invitation.service';
import { RsvpController } from './modules/rsvp/rsvp.controller';
import { RsvpService } from './modules/rsvp/rsvp.service';
import { QueueModule } from './infrastructure/queue/queue.service';
import { StorageModule } from './infrastructure/storage/storage.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.service';
import { NotificationsModule } from './modules/notifications/notifications.service';
import { NotificationsController } from './modules/notifications/notifications.controller';
import { AnalyticsModule } from './modules/analytics/analytics.service';
import { AnnouncementsController } from './modules/announcements/announcements.controller';
import { AnnouncementsService } from './modules/announcements/announcements.service';
import { TemplatesController } from './modules/templates/templates.controller';
import { TemplateAssetsService } from './modules/templates/template-assets.service';
import { TemplatesService } from './modules/templates/templates.service';
import { RenderContextService } from './modules/templates/render-context.service';
import { DesignController, PublicEventsController } from './modules/templates/design.controller';
import { DesignService } from './modules/templates/design.service';
import { PublicEventsService } from './modules/templates/public-events.service';
import { MediaController, PublicMediaController, PublicWallController } from './modules/media/media.controller';
import { LiveWallService } from './modules/media/live-wall.service';
import { AlbumService } from './modules/media/album.service';
import { MediaService } from './modules/media/media.service';
import { CheckInController, PublicCheckInController } from './modules/checkin/checkin.controller';
import { CheckInService } from './modules/checkin/checkin.service';
import { VideosController } from './modules/videos/videos.controller';
import { VideosService } from './modules/videos/videos.service';
import { PaymentsController } from './modules/payments/payments.controller';
import { PaymentsService } from './modules/payments/payments.service';
import { PAYMENT_PROVIDER } from './modules/payments/payment-provider';
import { AdminController } from './modules/admin/admin.controller';
import { AdminUsersController } from './modules/admin/admin-users.controller';
import { AdminUsersService } from './modules/admin/admin-users.service';
import { AdminService } from './modules/admin/admin.service';
import { AdminTemplatesService } from './modules/admin/admin-templates.service';
import { EventToolsController } from './modules/events/event-tools.controller';
import { EventToolsService } from './modules/events/event-tools.service';
import { OtpService } from './modules/guest-access/otp.service';
import { MetricsController } from './modules/metrics/metrics.controller';
import { PublicRegistrationController, RegistrationsController } from './modules/registrations/registrations.controller';
import { RegistrationsService } from './modules/registrations/registrations.service';
import { MembersController, TeamInviteController } from './modules/members/members.controller';
import { TeamInvitesService } from './modules/members/team-invites.service';
import { MembersService } from './modules/members/members.service';
import { LogisticsController } from './modules/logistics/logistics.controller';
import { LogisticsService } from './modules/logistics/logistics.service';
import { RemindersController } from './modules/reminders/reminders.controller';
import { RemindersService } from './modules/reminders/reminders.service';
import { DomainsController, PublicDomainsController } from './modules/domains/domains.controller';
import { DNS_RESOLVER, DomainsService, FROM_SETTINGS, HOSTNAME_PROVIDER } from './modules/domains/domains.service';
import { EventLinksModule } from './modules/domains/event-links.service';
import { systemResolver } from '@bulava/domains';
import { SettingsStore, type SettingsDb } from '@bulava/settings';
import { AdminSettingsController, PublicSiteController } from './modules/settings/settings.controller';
import { SettingsChecksService } from './modules/settings/settings-checks.service';
import { PlatformSettingsService, SETTINGS_STORE } from './modules/settings/settings.service';
import { WhatsAppWebhookController } from './modules/whatsapp/whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './modules/whatsapp/whatsapp-webhook.service';
import { AdminSitePagesController, PublicSitePagesController } from './modules/site-pages/site-pages.controller';
import { SitePagesService } from './modules/site-pages/site-pages.service';
import { AdminContactController, PublicContactController } from './modules/contact/contact.controller';
import { ContactService } from './modules/contact/contact.service';
import { AccountService } from './modules/users/account.service';
import { ConsentService } from './modules/users/consent.service';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { PlatformPermissionGuard } from './common/guards/platform-permission.guard';

/** Invitation tokens and the GetGabs webhook token travel in URLs; keep them out of logs. */
function redactUrl(url: string | undefined): string | undefined {
  return url?.replace(/(\/public\/invitations\/)[^/?#]+/, '$1[REDACTED]').replace(/(\/whatsapp\/getgabs)\?[^#]*/, '$1?[REDACTED]');
}

const bootConfig = loadConfig();

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level:
          bootConfig.LOG_LEVEL ??
          (bootConfig.NODE_ENV === 'production' ? 'info' : bootConfig.NODE_ENV === 'test' ? 'silent' : 'debug'),
        transport:
          bootConfig.LOG_FORMAT === 'pretty'
            ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        serializers: {
          req: (req: IncomingMessage & { id?: unknown }) => ({
            id: req.id,
            method: req.method,
            url: redactUrl(req.url),
          }),
        },
        customProps: () => ({ service: 'bulava-api' }),
      },
    }),
    PrismaModule,
    RedisModule,
    AuditModule,
    EventLinksModule,
    AudienceModule,
    QueueModule,
    StorageModule,
    EntitlementsModule,
    NotificationsModule,
    AnalyticsModule,
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.JWT_ACCESS_SECRET,
        signOptions: {
          expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
          issuer: 'bulava-api',
          audience: 'bulava',
          algorithm: 'HS256',
        },
        verifyOptions: { issuer: 'bulava-api', audience: 'bulava', algorithms: ['HS256'] },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG, RedisThrottlerStorage],
      useFactory: (config: AppConfig, storage: RedisThrottlerStorage) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
        storage,
        skipIf: () => config.RATE_LIMIT_DISABLED,
      }),
    }),
  ],
  controllers: [
    HealthController,
    MetaController,
    AuthController,
    PhoneAuthController,
    QuickStartController,
    PreviewController,
    UsersController,
    EventsController,
    ShareLinkController,
    FunctionsController,
    GroupsController,
    GuestsController,
    InvitationsController,
    RsvpController,
    GuestInvitationController,
    TemplatesController,
    DesignController,
    PublicEventsController,
    AnnouncementsController,
    NotificationsController,
    MediaController,
    PublicMediaController,
    PublicWallController,
    CheckInController,
    PublicCheckInController,
    VideosController,
    PaymentsController,
    WhatsAppWebhookController,
    AdminController,
    AdminUsersController,
    EventToolsController,
    MetricsController,
    RegistrationsController,
    PublicRegistrationController,
    MembersController,
    TeamInviteController,
    LogisticsController,
    RemindersController,
    DomainsController,
    PublicDomainsController,
    AdminSettingsController,
    PublicSiteController,
    AdminSitePagesController,
    PublicSitePagesController,
    AdminContactController,
    PublicContactController,
  ],
  providers: [
    // Guards run in this order: rate limit -> authenticate -> CSRF -> event permission.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: EventPermissionGuard },
    { provide: APP_GUARD, useClass: PlatformPermissionGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    {
      // Payments are optional: without Razorpay keys the checkout reports PAYMENTS_UNAVAILABLE.
      // Tests replace this with a fake; the real provider is built from the Super Admin's settings.
      provide: PAYMENT_PROVIDER,
      useValue: null,
    },
    {
      provide: SETTINGS_STORE,
      inject: [PrismaService, APP_CONFIG],
      useFactory: (prisma: PrismaService, config: AppConfig) => new SettingsStore(prisma as unknown as SettingsDb, config.TOKEN_ENCRYPTION_KEY),
    },
    PlatformSettingsService,
    SettingsChecksService,
    SessionService,
    MfaService,
    GoogleAuthService,
    PhoneOtpService,
    EmailCodeService,
    WhatsAppDeliveryService,
    AuthService,
    QuickStartService,
    PreviewService,
    EventsService,
    ShareLinkService,
    FunctionsService,
    GroupsService,
    GuestsService,
    InvitationTokenService,
    InvitationsService,
    GuestInvitationService,
    RsvpService,
    TemplatesService,
    TemplateAssetsService,
    RenderContextService,
    DesignService,
    PublicEventsService,
    AnnouncementsService,
    MediaService,
    AlbumService,
    LiveWallService,
    CheckInService,
    VideosService,
    PaymentsService,
    WhatsAppWebhookService,
    AdminService,
    AdminUsersService,
    AdminTemplatesService,
    EventToolsService,
    OtpService,
    RegistrationsService,
    MembersService,
    TeamInvitesService,
    LogisticsService,
    RemindersService,
    DomainsService,
    SitePagesService,
    ContactService,
    ConsentService,
    AccountService,
    { provide: DNS_RESOLVER, useValue: systemResolver },
    {
      // Customer-domain certificates come from the Super Admin's settings (Cloudflare for SaaS,
      // manual, or off). Tests replace this with a fake provider, or null for "none".
      provide: HOSTNAME_PROVIDER,
      useValue: FROM_SETTINGS,
    },
  ],
})
export class AppModule { }
