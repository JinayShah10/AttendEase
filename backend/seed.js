import './loadEnv.js';
import mongoose from 'mongoose';
import Subject from './models/Subject.js';
import Class from './models/Class.js';
import OpenElective, { getOpenElectiveModel } from './models/OpenElective.js';
import DepartmentElective from './models/DepartmentElective.js';
import ProgramElective from './models/ProgramElective.js';
import { subjects, classes, oeSubjects, tyProgramElectives } from './utils/seedData.js';

export async function seedDatabase(force = false) {
  try {
    // 1. Seed Subjects (Idempotent Upsert)
    console.log('Ensuring default master subjects...');
    await Subject.deleteMany({
      $or: [
        { name: { $in: ['CES', 'IPD-I', 'IPD-II', 'IPD-1', 'IPD-2', 'IPD-III', 'IPD-IV', 'IPD-3', 'IPD-4', 'Innovative Product Development III', 'Innovative Product Development IV'] } },
        { category: { $in: ['OE', 'DE', 'PE', 'Open Elective', 'Department Elective', 'Program Elective'] } },
        { electiveCategory: { $in: ['OE', 'DE', 'PE', 'DEPARTMENT_ELECTIVE', 'PROGRAM_ELECTIVE'] } },
        { isOE: true }
      ]
    });

    const normalSubjects = subjects.filter(sub =>
      !['OE', 'DE', 'PE', 'Open Elective', 'Department Elective', 'Program Elective'].includes(sub.category) &&
      !['OE', 'DE', 'PE', 'DEPARTMENT_ELECTIVE', 'PROGRAM_ELECTIVE'].includes(sub.electiveCategory) &&
      !sub.isOE
    );

    for (const sub of normalSubjects) {
      await Subject.findOneAndUpdate(
        { name: sub.name },
        { $set: sub },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // 2. Seed Classes (Idempotent Upsert)
    console.log('Ensuring default classes...');
    for (const cls of classes) {
      await Class.findOneAndUpdate(
        { name: cls.name },
        { $set: cls },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // 3. Seed Open Elective Subjects (SY) (Idempotent Upsert)
    console.log('Ensuring Open Elective Subjects (SY)...');
    const syOes = oeSubjects.filter(oe => oe.year === 'SY');
    for (const oe of syOes) {
      await OpenElective.findOneAndUpdate(
        { name: oe.name },
        { $set: oe },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // 4. Seed Open Elective Subjects (TY) (Idempotent Upsert)
    console.log('Ensuring Open Elective Subjects (TY)...');
    const TYOpenElective = getOpenElectiveModel('TY');
    await TYOpenElective.deleteMany({
      name: { $in: ['Advanced Java', 'DevOps', 'Advanced DBMS'] }
    });
    const tyOes = oeSubjects.filter(oe => oe.year === 'TY');
    for (const oe of tyOes) {
      await TYOpenElective.findOneAndUpdate(
        { name: oe.name },
        { $set: oe },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // 5. Seed TY Department Electives in TY_DE collection (Idempotent Upsert)
    console.log('Ensuring TY Department Electives in TY_DE collection...');
    const tyDeSubjects = subjects.filter(sub => sub.year === 'TY' && sub.electiveCategory === 'DEPARTMENT_ELECTIVE');
    for (const sub of tyDeSubjects) {
      await DepartmentElective.findOneAndUpdate(
        { name: sub.name },
        { $set: sub },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // 6. Seed TY Program Electives in TY_PE collection (Idempotent Upsert)
    console.log('Ensuring TY Program Electives in TY_PE collection...');
    // Drop old indexes to avoid unique key conflicts during transition (like set_1_theory_1)
    try {
      await ProgramElective.collection.dropIndexes();
      console.log('  Dropped legacy indexes in TY_PE.');
    } catch (e) {
      console.log('  No legacy indexes to drop or collection is empty.');
    }

    // Rebuild current schema indexes
    await ProgramElective.syncIndexes();

    // Delete legacy entries having 'theory' or 'lab' fields or legacy subjectNames before seeding
    const deleteResult = await ProgramElective.deleteMany({
      $or: [
        { theory: { $exists: true } },
        { lab: { $exists: true } },
        { subjectName: { $in: ['IS', 'IS Lab'] } }
      ]
    });
    if (deleteResult.deletedCount > 0) {
      console.log(`  Cleaned up ${deleteResult.deletedCount} legacy TY_PE documents.`);
    }

    for (const pe of tyProgramElectives) {
      await ProgramElective.findOneAndUpdate(
        { set: pe.set, subjectName: pe.subjectName, type: pe.type }, // match on set + subjectName + type
        { $set: pe },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // 7. Safe Migration: Remove old Program Elective entries from the general Subject collection.
    //    These were incorrectly stored there with isOE: true, category: 'Program Elective'.
    //    We only remove a subject if NO AttendanceRecord references it by subjectName.
    console.log('Migrating old Program Elective subjects out of Subject collection...');
    const allPeNames = [...tyProgramElectives.map(pe => pe.subjectName), 'InfoSec', 'InfoSec Lab']; // new names + legacy names too

    // Dynamically import AttendanceRecord only here (avoids circular at module level)
    const { default: AttendanceRecord } = await import('./models/AttendanceRecord.js');

    for (const name of allPeNames) {
      const existsInSubject = await Subject.exists({ name, category: 'Program Elective' });
      if (!existsInSubject) continue;

      const referencedByRecord = await AttendanceRecord.exists({ subjectName: name });
      if (referencedByRecord) {
        console.log(`  Keeping Subject "${name}" — referenced by AttendanceRecord(s). Skipping removal.`);
      } else {
        await Subject.deleteOne({ name, category: 'Program Elective' });
        console.log(`  Removed Subject "${name}" (now in TY_PE).`);
      }
    }

    console.log('Database Sync Completed!');
    console.log('='.repeat(30));

  } catch (error) {
    console.error('Error during automatic seeding:', error);
  }
}

// Allow running directly if needed
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
    const MONGODB_URI = process.env.MONGODB_URI;
    const force = process.argv.includes('--force');
    
    if (MONGODB_URI) {
        mongoose.connect(MONGODB_URI)
            .then(() => seedDatabase(force))
            .then(() => mongoose.disconnect());
    } else {
        console.error("MONGODB_URI not found in env");
    }
}
