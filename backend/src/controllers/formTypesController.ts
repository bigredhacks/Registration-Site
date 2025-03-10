import FormTypeModel from "../models/FormType";
import { Request, Response } from "express";
import { errorMessage, serverErrorMessage } from "../utils/resMessages";

/**
 * Fetches all form types.
 * 
 * GET: /formtypes/
 * 
 * If successful, returns 200 OK with JSON array of all form types.
 * If an error occurs, returns 500 Internal Server Error with error message.
 */
export const getAllFormTypes = async (req: Request, res: Response) => {
  try {
    const formTypes = await FormTypeModel.find(); // fetch all form types
    res.status(200).json(formTypes);
  } catch (err: any) {
    res.status(500).json(errorMessage(err)); 
  }
}

/**
 * Fetches a form type by ID.
 * 
 * GET: /formtypes/:id
 * 
 * If successful, returns 200 OK with JSON of the layout.
 * If the form type is not found, returns 404 Not Found with error message.
 * If an error occurs, returns 500 Internal Server Error with error message.
 */
export const getFormTypeById = async (req: Request, res: Response) => {
  try {
    const layout = await FormTypeModel.findById(req.params.id); // fetch layout by id
    if (!layout) {
      res.status(404).json(errorMessage("Form Type not found"));
      return
    }
    res.status(200).json(layout);
  } catch (err: any) {
    res.status(500).json(serverErrorMessage(err)); 
  }
}

/**
 * Creates a new form type.
 * 
 * POST: /formtypes/
 * 
 * Request body: Refer to API Docs for required fields.
 * 
 * If successful, returns 201 Created with JSON of the created form type.
 * If request body does not match specification (missing fields), returns 400 Bad Request with error message.
 * If the form type id is not found, returns 404 Not Found with error message.
 * If an error occurs, returns 500 Internal Server Error with error message.
 */
export const createFormType = async (req: Request, res: Response) => {
  const {
    eventName,
    eventDescription,
    eventLocation,
    layoutId,
    openDate,
    closeDate,
    startDate,
    endDate,
    description,
    dueDate,
    status
  } = req.body;

  // validate request body
  if (!eventName || !eventDescription || !eventLocation || !layoutId || !openDate || !closeDate || !startDate || !endDate || !description || !dueDate || !status) {
    res.status(400).json(errorMessage("Missing required fields"));
    return
  }

  try {
    const layout = await FormTypeModel.findById(layoutId); // fetch layout by id
    if (!layout) {
      res.status(404).json(errorMessage("Form Type not found"));
      return
    }
    const formType = new FormTypeModel(req.body); // create new layout
    await formType.save();
    res.status(201).json(formType);
  } catch (err: any) {
    res.status(500).json(serverErrorMessage(err));
  }
}

/**
 * Updates a form type by ID.
 * 
 * PUT: /formtypes/:id
 * 
 * Request body: Refer to API Docs for fields that can be updated.
 * 
 * If successful, returns 200 OK with JSON of the updated form type.
 * If the form type id  is not found, returns 404 Not Found with error message.
 * If an error occurs, returns 500 Internal Server Error with error message.
 */
export const updateFormType = async (req: Request, res: Response) => {
      // Validate that request body only contains allowed fields
      const allowedFields = [
        "eventName",
        "eventDescription",
        "eventLocation",
        "layoutId",
        "openDate",
        "closeDate",
        "startDate",
        "endDate",
        "description",
        "dueDate",
        "status",
        "maxTeamSize"
      ];
      const isValidUpdate = Object.keys(req.body).every((key) => allowedFields.includes(key));
  
      if (!isValidUpdate) {
        res.status(400).json({ error: "Invalid update fields provided" });
        return
      }
  
    try {
      const formType = await FormTypeModel.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); 
      if (!formType) {
        res.status(404).json(errorMessage("Form Type not found"));
        return
      }
      res.status(200).json(formType);
    } catch (err: any) {
      res.status(500).json(serverErrorMessage(err)); 
    }
}

/**
 * Deletes a form type by ID.
 * 
 * DELETE: /formtypes/:id
 * 
 * If successful, returns 200 OK with JSON of the deleted form type.
 * If the form type is not found, returns 404 Not Found with error message.
 * If an error occurs, returns 500 Internal Server Error with error message.
 */
export const deleteFormType = async (req: Request, res: Response) => {
  try {
    const deletedFormType = await FormTypeModel.findByIdAndDelete(req.params.id); // delete layout by id
    if (!deletedFormType) {
      res.status(404).json(errorMessage("Form Type not found"));
      return
    }
    res.status(200).json(deletedFormType);
  } catch (err) {
    res.status(500).json(serverErrorMessage(err));
  }
}
