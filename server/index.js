import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import { createRequire } from 'node:module'
import { randomBytes } from 'node:crypto'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')
const app = express()
const port = process.env.PORT || 5000
const tokenSecret = process.env.JWT_SECRET || 'development-only-change-me'
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET must be set in production.')

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }))
app.use(express.json({ limit: '1mb' }))

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    role: { type: String, enum: ['candidate', 'employer', 'admin'], default: 'candidate' },
    company: String,
    headline: String,
    skills: [String],
    resumeText: String,
    linkedinId: String,
}, { timestamps: true })

const jobSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    type: { type: String, enum: ['Full-time', 'Contract', 'Part-time', 'Remote'], default: 'Full-time' },
    salary: { type: String, default: 'Competitive' },
    description: { type: String, required: true },
    skills: [String],
    status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'pending' },
    employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })
jobSchema.index({ title: 'text', company: 'text', description: 'text', skills: 'text' })

const applicationSchema = new mongoose.Schema({
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['submitted', 'reviewing', 'interview', 'rejected', 'accepted'], default: 'submitted' },
    coverLetter: String,
}, { timestamps: true })

applicationSchema.index({ job: 1, candidate: 1 }, { unique: true })
const User = mongoose.model('User', userSchema)
const Job = mongoose.model('Job', jobSchema)
const Application = mongoose.model('Application', applicationSchema)

const knownSkills = [
    'javascript', 'typescript', 'react', 'node.js', 'node', 'express', 'mongodb', 'sql', 'python',
    'java', 'aws', 'docker', 'kubernetes', 'figma', 'product design', 'communication', 'leadership',
    'project management', 'agile', 'analytics', 'machine learning', 'css', 'html', 'git',
]

function extractSkills(text) {
    const normalized = text.toLowerCase()
    return knownSkills.filter((skill) => new RegExp(`(^|[^a-z0-9])${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(normalized))
}

function authenticate(req, res, next) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ message: 'Sign in to continue.' })
    try {
        req.user = jwt.verify(token, tokenSecret)
        return next()
    } catch {
        return res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
    }
}

function allow(...roles) {
    return (req, res, next) => roles.includes(req.user.role)
        ? next()
        : res.status(403).json({ message: 'You do not have permission to do that.' })
}

function publicUser(user) {
    return { id: user._id, name: user.name, email: user.email, role: user.role, company: user.company, headline: user.headline, skills: user.skills || [] }
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }))

app.post('/api/auth/register', async (req, res, next) => {
    try {
        const { name, email, password, role, company } = req.body
        if (!name || !email || !password || password.length < 8) return res.status(400).json({ message: 'Name, email, and a password of at least 8 characters are required.' })
        if (!['candidate', 'employer'].includes(role || 'candidate')) return res.status(400).json({ message: 'Choose candidate or employer account type.' })
        if ((role || 'candidate') === 'employer' && !company?.trim()) return res.status(400).json({ message: 'Company name is required for employer accounts.' })
        const user = await User.create({ name, email, password: await bcrypt.hash(password, 12), role: role || 'candidate', company })
        return res.status(201).json({ token: jwt.sign({ id: user.id, role: user.role }, tokenSecret, { expiresIn: '7d' }), user: publicUser(user) })
    } catch (error) { return next(error) }
})

app.post('/api/auth/login', async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email?.toLowerCase() }).select('+password')
        if (!user || !await bcrypt.compare(req.body.password || '', user.password || '')) return res.status(401).json({ message: 'Email or password is incorrect.' })
        return res.json({ token: jwt.sign({ id: user.id, role: user.role }, tokenSecret, { expiresIn: '7d' }), user: publicUser(user) })
    } catch (error) { return next(error) }
})

app.get('/api/profile', authenticate, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ message: 'Account not found.' })
        return res.json({ user: publicUser(user), resumeReady: Boolean(user.resumeText) })
    } catch (error) { return next(error) }
})

const upload = multer({
    storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, callback) => {
        const allowed = ['application/pdf', 'text/plain']
        if (!allowed.includes(file.mimetype)) {
            const error = new Error('Upload a PDF or plain text resume.')
            error.status = 400
            return callback(error)
        }
        return callback(null, true)
    }
})

app.post('/api/profile/resume', authenticate, allow('candidate'), upload.single('resume'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Choose a PDF or text resume.' })
        const text = req.file.mimetype === 'application/pdf'
            ? (await pdfParse(req.file.buffer)).text
            : req.file.buffer.toString('utf8')
        const skills = extractSkills(text)
        await User.findByIdAndUpdate(req.user.id, { resumeText: text.slice(0, 50000), skills })
        return res.json({ skills, message: 'Resume parsed successfully.' })
    } catch (error) { return next(error) }
})

app.get('/api/jobs', async (req, res, next) => {
    try {
        const filter = { status: 'active' }
        if (req.query.type) filter.type = req.query.type
        if (req.query.q) filter.$text = { $search: req.query.q }
        const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(100).populate('employer', 'name company')
        return res.json({ jobs })
    } catch (error) { return next(error) }
})

app.get('/api/jobs/matches', authenticate, allow('candidate'), async (req, res, next) => {
    try {
        const [jobs, candidate] = await Promise.all([
            Job.find({ status: 'active' }).sort({ createdAt: -1 }).limit(100),
            User.findById(req.user.id).select('skills'),
        ])
        const candidateSkills = new Set((candidate?.skills || []).map((skill) => skill.toLowerCase()))
        const matches = jobs.map((job) => {
            const jobSkills = job.skills || []
            const sharedSkills = jobSkills.filter((skill) => candidateSkills.has(skill.toLowerCase()))
            return { ...job.toObject(), matchScore: jobSkills.length ? Math.round(sharedSkills.length / jobSkills.length * 100) : 0, matchedSkills: sharedSkills }
        }).sort((first, second) => second.matchScore - first.matchScore)
        return res.json({ jobs: matches })
    } catch (error) { return next(error) }
})

app.post('/api/jobs', authenticate, allow('employer'), async (req, res, next) => {
    try {
        const { title, company, location, type, salary, description, skills } = req.body
        if (!title || !company || !location || !description) return res.status(400).json({ message: 'Title, company, location, and description are required.' })
        const job = await Job.create({ title, company, location, type, salary, description, skills: Array.isArray(skills) ? skills : [], employer: req.user.id })
        return res.status(201).json({ job })
    } catch (error) { return next(error) }
})

app.get('/api/employer/jobs', authenticate, allow('employer', 'admin'), async (req, res, next) => {
    try {
        const jobs = await Job.find(req.user.role === 'admin' ? {} : { employer: req.user.id }).sort({ createdAt: -1 })
        const jobIds = jobs.map((job) => job._id)
        const counts = await Application.aggregate([{ $match: { job: { $in: jobIds } } }, { $group: { _id: '$job', count: { $sum: 1 } } }])
        const countMap = new Map(counts.map((entry) => [String(entry._id), entry.count]))
        return res.json({ jobs: jobs.map((job) => ({ ...job.toObject(), applicationCount: countMap.get(String(job._id)) || 0 })) })
    } catch (error) { return next(error) }
})

app.post('/api/jobs/:jobId/applications', authenticate, allow('candidate'), async (req, res, next) => {
    try {
        const job = await Job.findOne({ _id: req.params.jobId, status: 'active' })
        if (!job) return res.status(404).json({ message: 'This job is no longer available.' })
        const application = await Application.create({ job: job.id, candidate: req.user.id, coverLetter: req.body.coverLetter })
        return res.status(201).json({ application })
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'You have already applied to this role.' })
        return next(error)
    }
})

app.get('/api/applications', authenticate, async (req, res, next) => {
    try {
        const filter = req.user.role === 'admin' ? {} : req.user.role === 'employer'
            ? { job: { $in: await Job.find({ employer: req.user.id }).distinct('_id') } }
            : { candidate: req.user.id }
        const applications = await Application.find(filter).sort({ createdAt: -1 }).populate('job').populate('candidate', 'name email skills')
        return res.json({ applications })
    } catch (error) { return next(error) }
})

app.patch('/api/applications/:applicationId', authenticate, allow('employer', 'admin'), async (req, res, next) => {
    try {
        const allowedStatuses = ['reviewing', 'interview', 'rejected', 'accepted']
        if (!allowedStatuses.includes(req.body.status)) return res.status(400).json({ message: 'Choose a valid application status.' })
        const application = await Application.findById(req.params.applicationId).populate('job')
        if (!application) return res.status(404).json({ message: 'Application not found.' })
        if (req.user.role !== 'admin' && String(application.job.employer) !== req.user.id) return res.status(403).json({ message: 'This application belongs to another employer.' })
        application.status = req.body.status
        await application.save()
        return res.json({ application })
    } catch (error) { return next(error) }
})

app.get('/api/admin/jobs', authenticate, allow('admin'), async (_req, res, next) => {
    try { return res.json({ jobs: await Job.find({ status: 'pending' }).sort({ createdAt: 1 }).populate('employer', 'name company') }) }
    catch (error) { return next(error) }
})

app.patch('/api/admin/jobs/:jobId/moderate', authenticate, allow('admin'), async (req, res, next) => {
    try {
        if (!['active', 'rejected'].includes(req.body.status)) return res.status(400).json({ message: 'Choose active or rejected.' })
        const job = await Job.findByIdAndUpdate(req.params.jobId, { status: req.body.status }, { new: true })
        if (!job) return res.status(404).json({ message: 'Job not found.' })
        return res.json({ job })
    } catch (error) { return next(error) }
})

app.get('/api/auth/linkedin/status', (_req, res) => {
    const configured = Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET && process.env.LINKEDIN_REDIRECT_URI)
    return res.json({ configured })
})

app.get('/api/auth/linkedin', (_req, res) => {
    const { LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI } = process.env
    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET || !LINKEDIN_REDIRECT_URI) return res.status(503).json({ message: 'LinkedIn import is not configured yet.' })
    const state = jwt.sign({ nonce: randomBytes(16).toString('hex') }, tokenSecret, { expiresIn: '10m' })
    const params = new URLSearchParams({ response_type: 'code', client_id: LINKEDIN_CLIENT_ID, redirect_uri: LINKEDIN_REDIRECT_URI, state, scope: 'openid profile email' })
    return res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`)
})

app.get('/api/auth/linkedin/callback', async (req, res) => {
    try {
        jwt.verify(req.query.state, tokenSecret)
        const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: req.query.code, redirect_uri: process.env.LINKEDIN_REDIRECT_URI, client_id: process.env.LINKEDIN_CLIENT_ID, client_secret: process.env.LINKEDIN_CLIENT_SECRET }) })
        const tokenData = await tokenResponse.json()
        if (!tokenResponse.ok) throw new Error(tokenData.error_description || 'LinkedIn authorization failed.')
        const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${tokenData.access_token}` } })
        const profile = await profileResponse.json()
        if (!profileResponse.ok || !profile.email) throw new Error('LinkedIn did not provide an email address.')
        const user = await User.findOneAndUpdate({ email: profile.email.toLowerCase() }, { $set: { name: profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim(), linkedinId: profile.sub }, $setOnInsert: { role: 'candidate' } }, { upsert: true, new: true, runValidators: true })
        const token = jwt.sign({ id: user.id, role: user.role }, tokenSecret, { expiresIn: '7d' })
        return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/?linkedin=success#token=${encodeURIComponent(token)}`)
    } catch (error) {
        const message = encodeURIComponent(error.message || 'LinkedIn import failed.')
        return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/?linkedin=error&message=${message}`)
    }
})

app.use((error, _req, res, _next) => {
    const status = error.status || (error.name === 'ValidationError' ? 400 : error.code === 11000 ? 409 : 500)
    return res.status(status).json({ message: status === 500 ? (process.env.NODE_ENV === 'production' ? 'Something went wrong.' : error.message) : error.message })
})

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/job-portal-system')
    .then(async () => {
        if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
            const email = process.env.ADMIN_EMAIL.toLowerCase()
            await User.updateOne(
                { email },
                { $setOnInsert: { name: 'Portal Admin', email, password: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), role: 'admin' } },
                { upsert: true },
            )
        }
        return app.listen(port, () => console.log(`Job portal API listening on http://localhost:${port}`))
    })
    .catch((error) => {
        console.error('MongoDB connection failed:', error.message)
        process.exit(1)
    })