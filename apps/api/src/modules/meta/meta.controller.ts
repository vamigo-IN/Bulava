import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Public } from '../../common/decorators/auth.decorators';

/** Reference data the apps need (event categories, languages). Driven by DB rows, not code. */
@ApiTags('meta')
@Public()
@Controller('meta')
export class MetaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('event-types')
  @Header('Cache-Control', 'public, max-age=300')
  eventTypes() {
    return this.prisma.eventType.findMany({
      where: { enabled: true },
      select: { key: true, name: true, description: true, detailsSchemaKey: true, defaultFunctions: true, defaultGroups: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Get('languages')
  @Header('Cache-Control', 'public, max-age=300')
  languages() {
    return this.prisma.language.findMany({
      where: { enabled: true },
      select: { code: true, name: true, nativeName: true, script: true, direction: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
