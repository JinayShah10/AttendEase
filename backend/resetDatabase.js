import './loadEnv.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { seedDatabase } from './seed.js';
import { fileURLToPath } from 'url';

// Import Models to purge
import AttendanceRecord from './models/AttendanceRecord.js';
import UploadedFile from './models/UploadedFile.js';
import AuditLog from './models/AuditLog.js';
import RefreshToken from './models/RefreshToken.js';

export async function performDatabaseReset(assignedClass = null) {
  if (assignedClass && (assignedClass.year || assignedClass.name) && assignedClass.division) {
    const year = assignedClass.year || (assignedClass.name ? assignedClass.name.split(' ')[0] : '');
    const div = assignedClass.division;
    const yearMatches = [year, assignedClass.name].filter(Boolean);

    // 1a. AttendanceRecords for this specific class only (NOT 'ALL' division uploads)
    const arQuery = {
      classYear: { $in: yearMatches },
      division: div
    };
    const arCount = await AttendanceRecord.countDocuments(arQuery);
    await AttendanceRecord.deleteMany(arQuery);

    // 1b. UploadedFiles for this specific class only
    const ufQuery = {
      classYear: { $in: yearMatches },
      division: div
    };
    const filesToDelete = await UploadedFile.find(ufQuery).select('storedFilePath');
    const ufCount = await UploadedFile.countDocuments(ufQuery);
    await UploadedFile.deleteMany(ufQuery);

    // Clean Supabase Storage files for the deleted UploadedFiles
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'reports';
    let deletedFilesCount = 0;

    if (SUPABASE_URL && SUPABASE_KEY && filesToDelete.length > 0) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false }
      });
      const filePaths = filesToDelete
        .map(f => f.storedFilePath)
        .filter(p => p && p.trim() !== '');

      if (filePaths.length > 0) {
        const { error: removeError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(filePaths);

        if (!removeError) {
          deletedFilesCount = filePaths.length;
        } else {
          console.error('Error deleting class files from Supabase Storage:', removeError);
        }
      }
    }

    // 1c. Drop dynamic student collection for this class (e.g. SY_D1_2026-27)
    const collections = await mongoose.connection.db.listCollections().toArray();
    const classColPattern = new RegExp(`^${year}_${div}_\\d{4}-\\d{2}$`, 'i');
    const targetCols = collections
      .map(c => c.name)
      .filter(name => classColPattern.test(name));

    let studentColsCount = 0;
    for (const colName of targetCols) {
      try {
        await mongoose.connection.db.dropCollection(colName);
        studentColsCount++;
      } catch (err) {
        console.error(`Error dropping student collection ${colName}:`, err);
      }
    }

    // 1d. Delete dynamic student class data folders on disk recursively for this class
    const uploadsDir = path.join(process.cwd(), 'backend', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      try {
        const items = fs.readdirSync(uploadsDir);
        for (const item of items) {
          const itemPath = path.join(uploadsDir, item);
          if (fs.existsSync(itemPath) && fs.statSync(itemPath).isDirectory()) {
            if (classColPattern.test(item)) {
              fs.rmSync(itemPath, { recursive: true, force: true });
            }
          }
        }
      } catch (err) {
        console.error('Error deleting class student data folders on disk:', err);
      }
    }

    // 2. Ensure default master data and subjects are properly seeded
    await seedDatabase(false);

    return {
      arCount,
      ufCount,
      alCount: 0,
      rtCount: 0,
      deletedFilesCount,
      studentColsCount
    };
  }

  // 1. Clear database documents for uploaded files, attendance, audit logs, and tokens
  const arCount = await AttendanceRecord.countDocuments();
  await AttendanceRecord.deleteMany({});
  
  const ufCount = await UploadedFile.countDocuments();
  await UploadedFile.deleteMany({});
  
  const alCount = await AuditLog.countDocuments();
  await AuditLog.deleteMany({});
  
  const rtCount = await RefreshToken.countDocuments();
  await RefreshToken.deleteMany({});

  // 1b. Drop dynamic student collections (e.g. SY_D1_2026-27, TY_D1_2026-27)
  const collections = await mongoose.connection.db.listCollections().toArray();
  const studentCols = collections
    .map(c => c.name)
    .filter(name => /^[A-Z0-9]+_[A-Z0-9]+_\d{4}-\d{2}$/i.test(name));
  
  let studentColsCount = 0;
  for (const colName of studentCols) {
    try {
      await mongoose.connection.db.dropCollection(colName);
      studentColsCount++;
    } catch (err) {
      console.error(`Error dropping student collection ${colName}:`, err);
    }
  }

  // 1c. Delete dynamic student class data folders on disk recursively
  const uploadsDir = path.join(process.cwd(), 'backend', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    try {
      const items = fs.readdirSync(uploadsDir);
      for (const item of items) {
        const itemPath = path.join(uploadsDir, item);
        if (fs.existsSync(itemPath) && fs.statSync(itemPath).isDirectory()) {
          // Check if folder matches student data class pattern (e.g. SY_D1_2026-27)
          if (/^[A-Z0-9]+_[A-Z0-9]+_\d{4}-\d{2}$/i.test(item)) {
            fs.rmSync(itemPath, { recursive: true, force: true });
          }
        }
      }
    } catch (err) {
      console.error('Error deleting student data folders on disk:', err);
    }
  }

  // 2. Clean Supabase Storage files
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'reports';
  let deletedFilesCount = 0;

  if (SUPABASE_URL && SUPABASE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });

    const folders = ['excel', 'pdf'];

    for (const folder of folders) {
      const { data: files, error: listError } = await supabase.storage
        .from(BUCKET_NAME)
        .list(folder, { limit: 200 });

      if (!listError && files && files.length > 0) {
        const filesToRemove = files
          .filter(f => f.name !== '.emptyFolderPlaceholder')
          .map(f => `${folder}/${f.name}`);

        if (filesToRemove.length > 0) {
          const { error: removeError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(filesToRemove);

          if (!removeError) {
            deletedFilesCount += filesToRemove.length;
          }
        }
      }
    }

    // Root files
    const { data: rootFiles, error: rootListError } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { limit: 100 });

    if (!rootListError && rootFiles && rootFiles.length > 0) {
      const rootFilesToRemove = rootFiles
        .filter(f => f.id !== null && f.name !== '.emptyFolderPlaceholder')
        .map(f => f.name);

      if (rootFilesToRemove.length > 0) {
        const { error: rootRemoveError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(rootFilesToRemove);

        if (!rootRemoveError) {
          deletedFilesCount += rootFilesToRemove.length;
        }
      }
    }
  }

  // 3. Ensure all default master data and subjects are properly updated/created
  await seedDatabase(false);

  return {
    arCount,
    ufCount,
    alCount,
    rtCount,
    deletedFilesCount,
    studentColsCount
  };
}

// Execute the reset directly if run via CLI
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  (async () => {
    console.log('='.repeat(50));
    console.log('STARTING DATABASE RESET AND CLEANUP PROCESS');
    console.log('='.repeat(50));

    let dbConnection = null;
    try {
      console.log('Connecting to MongoDB...');
      dbConnection = await mongoose.connect(process.env.MONGODB_URI);
      console.log('✔ Connected to MongoDB successfully!');

      const summary = await performDatabaseReset();
      console.log(`- Cleared ${summary.arCount} documents from 'attendancerecords'`);
      console.log(`- Cleared ${summary.ufCount} documents from 'uploadedfiles'`);
      console.log(`- Cleared ${summary.alCount} documents from 'auditlogs'`);
      console.log(`- Cleared ${summary.rtCount} documents from 'refreshtokens'`);
      console.log(`- Cleared ${summary.studentColsCount} dynamic student collections`);
      console.log(`- Purged ${summary.deletedFilesCount} total files from Supabase Storage`);

      console.log('\n' + '='.repeat(50));
      console.log('RESET SUMMARY');
      console.log('='.repeat(50));
      console.log(`- Cleared all dynamic student collections (${summary.studentColsCount} deleted)`);
      console.log('- Preserved all faculty and admin records');
      console.log('- Purged all attendance records & uploaded files');
      console.log('- Purged all audit logs and refresh token sessions');
      console.log('- Ensured/updated all master subjects and Open Electives successfully');
      console.log('='.repeat(50));
      console.log('DATABASE RESET/REPAIR COMPLETED SUCCESSFULLY!');
      console.log('='.repeat(50));
    } catch (error) {
      console.error('\n❌ Error occurred during database reset:', error);
    } finally {
      if (dbConnection) {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
      }
    }
  })();
}
