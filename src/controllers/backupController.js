/**
 * Backup Controller
 * Handles database backup creation, listing, download, and deletion
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { promisify } = require('util');

const execPromise = promisify(exec);

// Backup directory path
const BACKUP_DIR = path.join(__dirname, '../../backups');

// Ensure backup directory exists
const ensureBackupDir = async () => {
    try {
        await fs.access(BACKUP_DIR);
    } catch {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    }
};

/**
 * Create a manual database backup
 * POST /api/backups
 */
exports.createBackup = async (req, res) => {
    try {
        await ensureBackupDir();

        // Generate backup filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5);
        const filename = `backup_${timestamp}.sql`;
        const filepath = path.join(BACKUP_DIR, filename);

        // Get database credentials from environment
        const dbUrl = process.env.DATABASE_URL;

        if (!dbUrl) {
            return res.status(500).json({
                success: false,
                message: 'Database URL not configured'
            });
        }

        console.log(`Starting backup: ${filename}`);

        // Execute pg_dump command
        // Using DATABASE_URL for connection
        const command = `pg_dump "${dbUrl}" -f "${filepath}" --verbose --no-owner --no-acl`;

        const { stdout, stderr } = await execPromise(command);

        console.log('Backup stdout:', stdout);
        if (stderr) console.log('Backup stderr:', stderr);

        // Get file stats
        const stats = await fs.stat(filepath);
        const sizeInBytes = stats.size;
        const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

        res.json({
            success: true,
            message: 'Backup created successfully',
            data: {
                filename,
                size: `${sizeInMB} MB`,
                sizeInBytes,
                created_at: new Date().toISOString(),
                type: 'manual'
            }
        });

    } catch (error) {
        console.error('Backup creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create backup',
            error: error.message
        });
    }
};

/**
 * Get all backups
 * GET /api/backups
 */
exports.getAllBackups = async (req, res) => {
    try {
        await ensureBackupDir();

        // Read all files in backup directory
        const files = await fs.readdir(BACKUP_DIR);

        // Filter for .sql files and get their stats
        const backups = await Promise.all(
            files
                .filter(file => file.endsWith('.sql'))
                .map(async (file) => {
                    const filepath = path.join(BACKUP_DIR, file);
                    const stats = await fs.stat(filepath);
                    const sizeInBytes = stats.size;
                    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

                    return {
                        id: file,
                        name: file,
                        filename: file,
                        size: `${sizeInMB} MB`,
                        sizeInBytes,
                        date: stats.mtime.toISOString(),
                        created_at: stats.birthtime.toISOString(),
                        type: file.includes('manual') ? 'manual' : 'auto',
                        status: 'completed',
                        storage: 'local'
                    };
                })
        );

        // Sort by date (newest first)
        backups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json({
            success: true,
            data: backups
        });

    } catch (error) {
        console.error('Get backups error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch backups',
            error: error.message
        });
    }
};

/**
 * Get backup storage statistics
 * GET /api/backups/stats
 */
exports.getBackupStats = async (req, res) => {
    try {
        await ensureBackupDir();

        const files = await fs.readdir(BACKUP_DIR);
        const sqlFiles = files.filter(file => file.endsWith('.sql'));

        let totalSize = 0;
        for (const file of sqlFiles) {
            const filepath = path.join(BACKUP_DIR, file);
            const stats = await fs.stat(filepath);
            totalSize += stats.size;
        }

        const totalSizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);

        res.json({
            success: true,
            data: {
                total_backups: sqlFiles.length,
                used: parseFloat(totalSizeGB),
                total: 10, // 10 GB limit (configurable)
                unit: 'GB'
            }
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
};

/**
 * Download a backup file
 * GET /api/backups/:filename/download
 */
exports.downloadBackup = async (req, res) => {
    try {
        const { filename } = req.params;

        // Validate filename (prevent directory traversal)
        if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid filename'
            });
        }

        const filepath = path.join(BACKUP_DIR, filename);

        // Check if file exists
        try {
            await fs.access(filepath);
        } catch {
            return res.status(404).json({
                success: false,
                message: 'Backup file not found'
            });
        }

        // Set headers for file download
        res.setHeader('Content-Type', 'application/sql');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Stream the file
        const fileStream = fsSync.createReadStream(filepath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('Download backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to download backup',
            error: error.message
        });
    }
};

/**
 * Delete a backup file
 * DELETE /api/backups/:filename
 */
exports.deleteBackup = async (req, res) => {
    try {
        const { filename } = req.params;

        // Validate filename (prevent directory traversal)
        if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid filename'
            });
        }

        const filepath = path.join(BACKUP_DIR, filename);

        // Check if file exists
        try {
            await fs.access(filepath);
        } catch {
            return res.status(404).json({
                success: false,
                message: 'Backup file not found'
            });
        }

        // Delete the file
        await fs.unlink(filepath);

        res.json({
            success: true,
            message: 'Backup deleted successfully'
        });

    } catch (error) {
        console.error('Delete backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete backup',
            error: error.message
        });
    }
};
