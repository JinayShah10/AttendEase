import Subject from '../models/Subject.js';
import Class from '../models/Class.js';
import OpenElective, { getOpenElectiveModel } from '../models/OpenElective.js';
import ProgramElective from '../models/ProgramElective.js';
import { serverError } from '../utils/helpers.js';

/**
 * GET /api/master/subjects
 * Returns all subjects sorted by name.
 */
export const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 });
    return res.status(200).json(subjects);
  } catch (error) {
    return serverError(res, error, 'Error fetching subjects');
  }
};

/**
 * GET /api/master/classes
 * Returns all classes sorted by name.
 */
export const getClasses = async (req, res) => {
  try {
    const classes = await Class.find().sort({ name: 1 });
    return res.status(200).json(classes);
  } catch (error) {
    return serverError(res, error, 'Error fetching classes');
  }
};

/**
 * GET /api/master/oe-subjects
 * Returns all open elective subjects from the SY_OE collection.
 */
export const getOpenElectives = async (req, res) => {
  try {
    const classYear = req.query.classYear || req.query.year;
    const model = classYear ? getOpenElectiveModel(classYear) : OpenElective;
    const oeSubjects = await model.find().sort({ name: 1 });
    return res.status(200).json(oeSubjects);
  } catch (error) {
    return serverError(res, error, 'Error fetching OE subjects');
  }
};

/**
 * GET /api/master/pe-subjects
 * Returns all TY Program Elective options from the TY_PE collection.
 * Grouped by set (SET1, SET2) for easy UI rendering.
 */
export const getProgramElectives = async (req, res) => {
  try {
    const peOptions = await ProgramElective.find({ active: true }).sort({ set: 1, subjectName: 1 });
    return res.status(200).json(peOptions);
  } catch (error) {
    return serverError(res, error, 'Error fetching PE subjects');
  }
};
