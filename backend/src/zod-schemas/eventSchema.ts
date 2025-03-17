import { z } from 'zod';
import { EventStatus } from '../types/eventStatus';

export const eventSchema = z.object({
  eventName: z.string(),
  eventDescription: z.string(),
  eventLocation: z.string(),
  layoutId: z.string(),
  openDate: z.date(),
  closeDate: z.date(),
  startDate: z.date(),
  endDate: z.date(),
  status: z.nativeEnum(EventStatus),
  maxTeamSize: z.number().int().positive(),
})