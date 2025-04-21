import mongoose from "mongoose";
import { FormStatus, QuestionType } from "../types/enums";
const Schema = mongoose.Schema;

/**
 * FormQuestionSchema
 * 
 * Refer to API Docs for JSON Format.
 */
export const FormQuestionSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  required: {
    type: Boolean,
    default: false,
    required: true,
  },
  type:{
    type: String,
    enum: QuestionType,
    default: QuestionType.SHORT_TEXT,
  },
  defaultValue: {
    type: String,
  },
  options: {
    type: [String],
  },
  minLength: {
    type: Number,
  },
  maxLength: {
    type: Number,
  }
});

/**
 * FormLayoutSchema
 * 
 * Refer to API Docs for JSON Format.
 */
export const FormLayoutSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: FormStatus,
    default: FormStatus.OPEN,
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
  formQuestions: {
    type: [FormQuestionSchema],
  }

})

const FormQuestionModel = mongoose.model("FormQuestion", FormQuestionSchema);
const FormLayoutModel = mongoose.model("FormLayout", FormLayoutSchema);

export { FormQuestionModel };
export { FormLayoutModel}