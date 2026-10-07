import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { PreviewService } from './preview.service';

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

@ApiTags('public-preview')
@Public()
@Controller('public/preview')
export class PreviewController {
  constructor(private readonly preview: PreviewService) {}

  /** The watermarked preview behind a host's preview link. */
  @Get(':token')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  view(@Param('token') token: string) {
    if (!TOKEN.test(token)) throw AppError.notFound('Preview');
    return this.preview.view(token);
  }
}
