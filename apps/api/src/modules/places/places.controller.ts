import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  MapLinkSchema,
  PlaceAutocompleteSchema,
  PlaceDetailsQuerySchema,
  PlaceIdSchema,
  type MapLinkInput,
  type PlaceAutocompleteInput,
  type PlaceDetailsQuery,
} from '@bulava/validation';
import { EventAccess, RequireEventPermission } from '../../common/decorators/auth.decorators';
import { ApiZodBody, ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { EventAccessContext } from '../../common/request-context';
import { PlacesService } from './places.service';

/**
 * Venues for an event's functions (ADR-072): search as the host types, the
 * chosen place's address and location, and the spot of a pasted Google Maps
 * link. Whoever may manage the event's functions may use them; Google is
 * asked by the server, with the platform's key.
 */
@ApiTags('places')
@Controller('events/:eventId/places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  /** Whether the venue field searches, and the public embed key for its map (never the server key). */
  @Get('status')
  @RequireEventPermission('function.manage')
  status() {
    return this.places.status();
  }

  @Get('autocomplete')
  @RequireEventPermission('function.manage')
  @Throttle({ default: { limit: 90, ttl: 60_000 } })
  autocomplete(@EventAccess() access: EventAccessContext, @ZodQuery(PlaceAutocompleteSchema) query: PlaceAutocompleteInput) {
    return this.places.autocomplete(query, access.userId);
  }

  /** "Location not found": the spot of a link from Google Maps (a dropped pin's Share link). */
  @Post('link')
  @HttpCode(200)
  @RequireEventPermission('function.manage')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @ApiZodBody(MapLinkSchema)
  link(@EventAccess() access: EventAccessContext, @ZodBody(MapLinkSchema) body: MapLinkInput) {
    return this.places.resolveLink(body.url, access.userId);
  }

  @Get(':placeId')
  @RequireEventPermission('function.manage')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  details(
    @EventAccess() access: EventAccessContext,
    @Param('placeId', new ZodValidationPipe(PlaceIdSchema)) placeId: string,
    @ZodQuery(PlaceDetailsQuerySchema) query: PlaceDetailsQuery,
  ) {
    return this.places.details(placeId, query.sessionToken, access.userId);
  }
}
