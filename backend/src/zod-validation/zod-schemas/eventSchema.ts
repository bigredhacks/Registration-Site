import { z } from 'zod';
import { EventStatus } from '../../types/enums';
import { validMongoId } from '../string-validation/validMongoId';
import { validDate } from '../string-validation/validDate';

// Full Schema for Event (POST requests)
export const eventSchema = z.object({
  eventName: z.string(),
  eventDescription: z.string(),
  eventLocation: z.string(),
  layoutId: validMongoId,
  openDate: validDate,
  closeDate: validDate,
  startDate: validDate,
  endDate: validDate,
  status: z.nativeEnum(EventStatus),
  maxTeamSize: z.number().int().positive(),
})

// Schema for PATCH requests (all fields optional)
export const eventPatchSchema = eventSchema.partial();

type Event = z.infer<typeof eventSchema>;

export default Event;