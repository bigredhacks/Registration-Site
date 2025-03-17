import { z } from 'zod';
import { EventStatus } from '../types/eventStatus';
import { mongoIdSchema } from './mongoIdSchema';

// Full Schema for Event (POST requests)
export const eventSchema = z.object({
  eventName: z.string(),
  eventDescription: z.string(),
  eventLocation: z.string(),
  layoutId: mongoIdSchema,
  openDate: z.date(),
  closeDate: z.date(),
  startDate: z.date(),
  endDate: z.date(),
  status: z.nativeEnum(EventStatus),
  maxTeamSize: z.number().int().positive(),
})

// Schema for PATCH requests (all fields optional)
export const eventPatchSchema = eventSchema.partial();

type Event = z.infer<typeof eventSchema>;

export default Event;