import { z } from 'zod';
import { EventStatus } from '../../types/enums';
import { validMongoId } from '../string-validation/validMongoId';
import { validDate } from '../string-validation/validDate';
import Event from "../../models/Event";

// Full Schema for Event (POST requests)

const baseEventSchema = z.object({
  eventName: z.string(),
  eventDescription: z.string(),
  eventLocation: z.string(),
  layoutId: validMongoId,
  formOpenDate: validDate,
  formCloseDate: validDate,
  eventStartDate: validDate,
  eventEndDate: validDate,
  status: z.nativeEnum(EventStatus),
  maxTeamSize: z.number().int().positive(),
});

export const eventSchema = baseEventSchema
.refine(
  (data) => new Date(data.eventStartDate) < new Date(data.eventEndDate),
  {
    message: "Event start date must be before the event end date.",
    path: ["eventStartDate"],
  }
)
.refine(
  (data) => new Date(data.formOpenDate) < new Date(data.formCloseDate),
  {
    message: "Form open date must be before the form close date.",
    path: ["formOpenDate"],
  }
)
.refine(
  (data) => new Date(data.formCloseDate) < new Date(data.eventEndDate),
  {
    message: "Form close date must be before the event end date.",
    path: ["formCloseDate"],
  }
)

.superRefine(async (data, ctx) => {
  if (data.status === EventStatus.ACTIVE) {
    const activeEvent = await Event.findOne({ status: EventStatus.ACTIVE });
    if (activeEvent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only one event can be active at a time.",
        path: ["status"], // Path to the field causing the error
      });
    }
  }
});

// Schema for PATCH requests (all fields optional)
export const eventPatchSchema = baseEventSchema.partial();

type Event = z.infer<typeof eventSchema>;

export default Event;