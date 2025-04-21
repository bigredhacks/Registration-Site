import mongoose from "mongoose";
const Schema = mongoose.Schema;
import { EventStatus } from "../types/enums";

/**
 * EventSchema
 * 
 * Refer to API Docs for JSON Format.
 */
export const EventSchema = new Schema({
  eventName: {
    type: String,
    required: true,
  },
  eventDescription: {
    type: String,
    required: true,
  },
  eventLocation: {
    type: String,
    required: true,
  },
  layoutId: {
    type: Schema.Types.ObjectId,
    ref: "FormLayout",
    required: true,
  },
  openDate: {
    type: Date,
    required: true,
  },
  closeDate: {
    type: Date,
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: EventStatus,
    default: EventStatus.UPCOMING,
    required: true,
  },
  maxTeamSize: {
    type: Number,
    required: true,
  },
})

const EventModel = mongoose.model("Event", EventSchema);

export default EventModel;