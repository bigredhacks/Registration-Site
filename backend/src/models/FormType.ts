import mongoose from "mongoose";
const Schmea = mongoose.Schema;
import { EventStatus } from "../types/eventStatus";

/**
 * FormTypeSchema
 * 
 * Refer to API Docs for JSON Format.
 */
export const FormTypeSchema = new Schmea({
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
    type: Schmea.Types.ObjectId,
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
  description: {
    type: String,
    required: true,
  },
  dueDate: {
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

const FormTypeModel = mongoose.model("FormType", FormTypeSchema);

export default FormTypeModel