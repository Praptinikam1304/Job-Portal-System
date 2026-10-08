import { useEffect, useMemo, useState } from 'react'
import {
    ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness,
    Check, ChevronDown, CircleHelp, FileText, Filter, LayoutDashboard, LogOut,
    MapPin, Menu, Plus, Search, Settings2, ShieldCheck, Sparkles, Upload, Users, X,
} from 'lucide-react'
import './App.css'

const demoJobs = [
    { id: 'job-1', title: 'Senior Product Designer', company: 'Linear', location: 'New York, NY · Hybrid', type: 'Full-time', salary: '$145k – $180k', posted: '2 days ago', color: 'coral', initials: 'L', skills: ['Product design', 'Figma', 'Research'], description: 'Shape the next generation of tools for teams that build products. Partner closely with engineering and product to turn complex workflows into calm, considered experiences.', status: 'active', match: 96 },
    { id: 'job-2', title: 'Frontend Engineer', company: 'Vercel', location: 'Remote · US', type: 'Full-time', salary: '$160k – $210k', posted: '1 day ago', color: 'ink', initials: 'V', skills: ['React', 'TypeScript', 'CSS'], description: 'Build beautiful, performant interfaces used by developers around the world. Work across the dashboard, deployment experience, and design system.', status: 'active', match: 91 },
    { id: 'job-3', title: 'Product Manager, Growth', company: 'Notion', location: 'San Francisco, CA · Hybrid', type: 'Full-time', salary: '$150k – $195k', posted: '3 days ago', color: 'mint', initials: 'N', skills: ['Analytics', 'Strategy', 'Experimentation'], description: 'Own a high-impact growth area, from identifying opportunities to shipping experiments that help more people get value from their workspace.', status: 'active', match: 84 },
    { id: 'job-4', title: 'Platform Engineer', company: 'Figma', location: 'Remote · North America', type: 'Contract', salary: '$120 – $160 / hr', posted: '4 days ago', color: 'yellow', initials: 'F', skills: ['Node.js', 'AWS', 'Kubernetes'], description: 'Help scale a creative platform that enables teams to collaborate in real time. Improve reliability and developer velocity across the platform.', status: 'active', match: 78 },
]

const demoPending = [
    { id: 'pending-1', title: 'Senior Data Analyst', company: 'Northstar Health', location: 'Boston, MA · Hybrid', type: 'Full-time', salary: '$115k – $145k', posted: '32 min ago', color: 'mint', initials: 'N', skills: ['SQL', 'Analytics', 'Python'], description: 'Turn patient and care data into actionable insights for our clinical teams.', status: 'pending' },
    { id: 'pending-2', title: 'Brand Designer', company: 'Common Good', location: 'Remote · US', type: 'Full-time', salary: '$105k – $130k', posted: '1 hr ago', color: 'coral', initials: 'C', skills: ['Brand', 'Figma', 'Art direction'], description: 'Build a clear and memorable visual system for a new generation of thoughtful brands.', status: 'pending' },
]

const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'jobs', label: 'Find jobs', icon: Search },
    { id: 'applications', label: 'Applications', icon: FileText },
]

function readSavedUser() {
    try { return JSON.parse(localStorage.getItem('job-portal-user') || 'null') } catch { return null }
}

function readLinkedInError() {
    const params = new URLSearchParams(window.location.search)
    return params.get('linkedin') === 'error' ? params.get('message') || 'LinkedIn import failed.' : ''
}

function App() {
    const [user, setUser] = useState(readSavedUser)
    const [demoRole, setDemoRole] = useState('candidate')
    const [page, setPage] = useState('overview')
    const [jobs, setJobs] = useState(demoJobs)
    const [pendingJobs, setPendingJobs] = useState(demoPending)
    const [applications, setApplications] = useState([
        { id: 'app-1', jobId: 'job-1', status: 'reviewing', date: 'Oct 03, 2026' },
        { id: 'app-2', jobId: 'job-3', status: 'submitted', date: 'Oct 01, 2026' },
    ])
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState('All roles')
    const [modal, setModal] = useState('')
    const [notice, setNotice] = useState(readLinkedInError)
    const [apiOnline, setApiOnline] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [resumeSkills, setResumeSkills] = useState([])
    const [busy, setBusy] = useState(false)

    const role = user?.localDemo ? demoRole : user?.role || demoRole
    const isDemo = !user || Boolean(user.localDemo)
    const displayName = user?.name || (role === 'employer' ? 'Alex Morgan' : role === 'admin' ? 'Jordan Lee' : 'Sam Rivera')
    const initials = displayName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
    const currentApps = applications.map((application) => ({ ...application, job: application.job || jobs.find((job) => job.id === application.jobId) || demoJobs.find((job) => job.id === application.jobId) }))

    useEffect(() => {
        fetch('/api/health').then((response) => response.ok && response.json()).then((data) => {
            if (!data) return
            setApiOnline(true)
            return fetch('/api/jobs').then((response) => response.json()).then(async (data) => {
                if (Array.isArray(data.jobs)) setJobs(data.jobs.map((job) => ({ ...job, id: job._id })))
                const token = localStorage.getItem('job-portal-token')
                if (!token) return
                const headers = { Authorization: `Bearer ${token}` }
                const profileResponse = await fetch('/api/profile', { headers })
                if (!profileResponse.ok) return
                const profile = await profileResponse.json()
                setUser(profile.user)
                setResumeSkills(profile.user.skills || [])
                const applicationResponse = await fetch('/api/applications', { headers })
                if (applicationResponse.ok) {
                    const result = await applicationResponse.json()
                    setApplications(result.applications.map((application) => ({
                        id: application._id,
                        jobId: application.job?._id,
                        job: application.job ? { ...application.job, id: application.job._id } : null,
                        status: application.status,
                        date: new Date(application.createdAt).toLocaleDateString(),
                        candidate: application.candidate,
                    })))
                }
                const dashboardPath = profile.user.role === 'admin' ? '/api/admin/jobs' : profile.user.role === 'employer' ? '/api/employer/jobs' : ''
                if (dashboardPath) {
                    const dashboardResponse = await fetch(dashboardPath, { headers })
                    if (dashboardResponse.ok) {
                        const dashboard = await dashboardResponse.json()
                        const listings = dashboard.jobs.map((job) => ({ ...job, id: job._id }))
                        if (profile.user.role === 'admin') setPendingJobs(listings)
                        else setJobs(listings)
                    }
                }
            })
        }).catch(() => setApiOnline(false))
    }, [])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const token = window.location.hash.match(/token=([^&]+)/)?.[1]
        if (params.get('linkedin') === 'success' && token) {
            localStorage.setItem('job-portal-token', decodeURIComponent(token))
            window.history.replaceState({}, '', '/')
            const authToken = decodeURIComponent(token)
            void fetch('/api/profile', { headers: { Authorization: `Bearer ${authToken}` } }).then((response) => response.json()).then((data) => {
                if (data.user) {
                    setUser(data.user)
                    localStorage.setItem('job-portal-user', JSON.stringify(data.user))
                    setResumeSkills(data.user.skills || [])
                }
                setNotice('LinkedIn profile connected. Complete your profile to improve your matches.')
            }).catch(() => setNotice('LinkedIn profile connected. Sign in to continue.'))
        } else if (params.get('linkedin') === 'error') {
            window.history.replaceState({}, '', '/')
        }
    }, [])

    useEffect(() => {
        if (!notice) return undefined
        const timeout = window.setTimeout(() => setNotice(''), 3600)
        return () => window.clearTimeout(timeout)
    }, [notice])

    const filteredJobs = useMemo(() => jobs.map((job) => {
        if (!resumeSkills.length || !job.skills?.length) return job
        const profileSkills = new Set(resumeSkills.map((skill) => skill.toLowerCase()))
        const matched = job.skills.filter((skill) => profileSkills.has(skill.toLowerCase())).length
        return { ...job, match: Math.round((matched / job.skills.length) * 100) }
    }).filter((job) => {
        const searchText = `${job.title} ${job.company} ${job.location} ${(job.skills || []).join(' ')}`.toLowerCase()
        const matchesQuery = searchText.includes(query.toLowerCase())
        const matchesFilter = filter === 'All roles' || job.type === filter
        return matchesQuery && matchesFilter
    }).sort((first, second) => resumeSkills.length ? (second.match || 0) - (first.match || 0) : 0), [filter, jobs, query, resumeSkills])

    function goTo(nextPage) {
        setPage(nextPage)
        setMobileOpen(false)
    }

    async function authenticate(form) {
        if (!apiOnline) {
            if (form.get('mode') !== 'register') {
                setNotice('Sign-in needs the API. Create a local demo profile or continue as a guest.')
                return
            }
            const name = String(form.get('name') || '').trim()
            const accountRole = String(form.get('role') || 'candidate')
            const company = String(form.get('company') || '').trim()
            if (accountRole === 'employer' && !company) {
                setNotice('Add your company name to create an employer profile.')
                return
            }
            const localUser = { id: `local-${Date.now()}`, name, email: String(form.get('email')).toLowerCase(), role: accountRole, company, skills: [], localDemo: true }
            localStorage.removeItem('job-portal-token')
            localStorage.setItem('job-portal-user', JSON.stringify(localUser))
            setUser(localUser)
            setDemoRole(accountRole)
            setResumeSkills([])
            setApplications(accountRole === 'candidate' ? [
                { id: 'app-1', jobId: 'job-1', status: 'reviewing', date: 'Oct 03, 2026' },
                { id: 'app-2', jobId: 'job-3', status: 'submitted', date: 'Oct 01, 2026' },
            ] : [])
            setJobs(accountRole === 'employer' ? [] : demoJobs)
            setModal('')
            setNotice('Demo profile created on this device. Data is not synced to a server.')
            return
        }
        setBusy(true)
        try {
            const response = await fetch(`/api/auth/${form.get('mode')}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: form.get('name'), email: form.get('email'), password: form.get('password'), role: form.get('role'), company: form.get('company') }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || 'Could not sign in.')
            localStorage.setItem('job-portal-token', data.token)
            localStorage.setItem('job-portal-user', JSON.stringify(data.user))
            setUser(data.user)
            setResumeSkills(data.user.skills || [])
            const headers = { Authorization: `Bearer ${data.token}` }
            const [jobResponse, applicationResponse] = await Promise.all([
                fetch(data.user.role === 'employer' ? '/api/employer/jobs' : '/api/jobs', { headers }),
                fetch('/api/applications', { headers }),
            ])
            if (jobResponse.ok) {
                const result = await jobResponse.json()
                const listings = result.jobs.map((job) => ({ ...job, id: job._id }))
                if (data.user.role === 'admin') setPendingJobs(listings)
                else setJobs(listings)
            }
            if (applicationResponse.ok) {
                const result = await applicationResponse.json()
                setApplications(result.applications.map((application) => ({
                    id: application._id,
                    jobId: application.job?._id,
                    job: application.job ? { ...application.job, id: application.job._id } : null,
                    status: application.status,
                    date: new Date(application.createdAt).toLocaleDateString(),
                    candidate: application.candidate,
                })))
            }
            setModal('')
            setNotice(`Welcome, ${data.user.name.split(' ')[0]}.`)
        } catch (error) {
            setNotice(error.message || 'The API is not available. You can keep exploring demo mode.')
        } finally { setBusy(false) }
    }

    function signOut() {
        localStorage.removeItem('job-portal-token')
        localStorage.removeItem('job-portal-user')
        setUser(null)
        setDemoRole('candidate')
        setPage('overview')
        setNotice('You are back in demo mode.')
    }

    async function applyToJob(job) {
        const alreadyApplied = applications.some((application) => application.jobId === job.id)
        if (alreadyApplied) return setNotice('You have already applied to this role.')
        const token = localStorage.getItem('job-portal-token')
        if (token && apiOnline) {
            try {
                const response = await fetch(`/api/jobs/${job.id}/applications`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
                const data = await response.json()
                if (!response.ok) throw new Error(data.message)
            } catch (error) { return setNotice(error.message || 'Application could not be sent.') }
        }
        setApplications((items) => [{ id: `app-${Date.now()}`, jobId: job.id, status: 'submitted', date: 'Just now' }, ...items])
        setNotice(`Application sent to ${job.company}.`)
    }

    async function parseResume(file) {
        if (!file) return
        const token = localStorage.getItem('job-portal-token')
        if (token && apiOnline) {
            const body = new FormData()
            body.append('resume', file)
            const response = await fetch('/api/profile/resume', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body })
            const data = await response.json()
            if (!response.ok) throw new Error(data.message)
            setResumeSkills(data.skills)
        } else {
            if (file.type === 'application/pdf') throw new Error('Connect the API and MongoDB to parse PDF resumes. Text resumes work in demo mode.')
            const text = file.type === 'text/plain' ? await file.text() : file.name
            const skills = ['javascript', 'typescript', 'react', 'node.js', 'node', 'express', 'mongodb', 'sql', 'python', 'java', 'aws', 'docker', 'figma', 'analytics', 'communication', 'leadership', 'css']
            setResumeSkills(skills.filter((skill) => text.toLowerCase().includes(skill)))
        }
        setNotice('Resume analyzed. Your job matches are ready.')
        setModal('')
        goTo('jobs')
    }

    async function createJob(form) {
        const values = Object.fromEntries(new FormData(form).entries())
        const job = { ...values, id: `job-${Date.now()}`, skills: values.skills.split(',').map((skill) => skill.trim()).filter(Boolean), posted: 'Just now', status: isDemo ? 'active' : 'pending', color: 'yellow', initials: values.company.slice(0, 1).toUpperCase(), match: 0 }
        const token = localStorage.getItem('job-portal-token')
        if (token && apiOnline) {
            try {
                const response = await fetch('/api/jobs', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(job) })
                const data = await response.json()
                if (!response.ok) throw new Error(data.message)
                job.id = data.job._id
                job.status = data.job.status
            } catch (error) { setNotice(error.message || 'Job could not be posted.'); return }
        }
        setJobs((items) => [job, ...items])
        if (job.status === 'pending') setPendingJobs((items) => [job, ...items])
        setModal('')
        setNotice(job.status === 'pending' ? 'Job submitted for moderation.' : 'Your job is live.')
    }

    async function moderateJob(job, status) {
        const token = localStorage.getItem('job-portal-token')
        if (token && apiOnline) {
            try {
                const response = await fetch(`/api/admin/jobs/${job.id}/moderate`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
                const data = await response.json()
                if (!response.ok) throw new Error(data.message)
            } catch (error) { setNotice(error.message || 'Listing could not be moderated.'); return }
        }
        setPendingJobs((items) => items.filter((item) => item.id !== job.id))
        if (status === 'active') setJobs((items) => [{ ...job, status }, ...items])
        setNotice(status === 'active' ? `${job.title} is now live.` : 'Listing rejected.')
    }

    const nav = role === 'admin'
        ? [...navItems.slice(0, 1), { id: 'moderation', label: 'Moderation', icon: ShieldCheck }, { id: 'jobs', label: 'All jobs', icon: Search }]
        : role === 'employer'
            ? [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'jobs', label: 'My listings', icon: BriefcaseBusiness }, { id: 'applications', label: 'Applicants', icon: Users }]
            : navItems

    return (
        <div className="app-shell">
            <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
                <a className="brand" href="#overview" onClick={() => goTo('overview')} aria-label="Northstar home"><span className="brand-mark"><ArrowUpRight size={19} strokeWidth={2.5} /></span><span>northstar<span className="brand-period">.</span></span></a>
                <div className="workspace-label">WORKSPACE</div>
                <button className="workspace-switch" onClick={() => setModal('account')}><span className="workspace-avatar">{role === 'employer' ? 'S' : role === 'admin' ? 'N' : 'P'}</span><span className="workspace-info"><b>{role === 'employer' ? 'Studio North' : role === 'admin' ? 'Northstar team' : 'Personal space'}</b><small>{role === 'employer' ? 'Employer workspace' : role === 'admin' ? 'Admin workspace' : 'Candidate workspace'}</small></span><ChevronDown size={15} /></button>
                <div className="nav-label">MENU</div>
                <nav className="main-nav" aria-label="Main navigation">
                    {nav.map((item) => {
                        const Icon = item.icon
                        return <button key={item.id} className={`nav-item ${page === item.id ? 'nav-item-active' : ''}`} onClick={() => goTo(item.id)}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.id === 'applications' && role === 'candidate' && <span className="nav-count">{applications.length}</span>}{item.id === 'moderation' && <span className="nav-count nav-count-warm">{pendingJobs.length}</span>}</button>
                    })}
                </nav>
                {role === 'candidate' && <section className="sidebar-match"><div className="match-orbit"><Sparkles size={16} /></div><p>Make your next move</p><span>Upload your resume to see how you match.</span><button onClick={() => setModal('resume')}>Add resume <ArrowRight size={14} /></button></section>}
                <div className="sidebar-bottom"><button className="nav-item" onClick={() => setModal('help')}><CircleHelp size={17} /><span>Help center</span></button><button className="nav-item" onClick={() => setModal('settings')}><Settings2 size={17} /><span>Settings</span></button><div className="profile-row"><div className="profile-avatar">{initials}</div><div className="profile-copy"><b>{displayName}</b><small>{role === 'admin' ? 'Administrator' : role === 'employer' ? 'Hiring team' : 'Candidate'}</small></div><button className="icon-button profile-menu" title={user ? 'Sign out' : 'Sign in'} onClick={() => user ? signOut() : setModal('account')}>{user ? <LogOut size={16} /> : <ChevronDown size={16} />}</button></div></div>
            </aside>

            {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
            <main className="main-area">
                <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><b>{nav.find((item) => item.id === page)?.label || 'Overview'}</b></div><div className="topbar-actions"><span className={`system-status ${apiOnline ? 'status-live' : ''}`}><i />{apiOnline ? 'API connected' : 'Demo mode'}</span>{!user ? <button className="button button-dark top-signin" onClick={() => setModal('account')}>Sign in <ArrowRight size={14} /></button> : <button className="icon-button notification-button" title="Notifications" onClick={() => setNotice('You’re all caught up.')}><Bell size={17} /><i /></button>}</div></header>

                {!user && <div className="demo-banner"><span><Sparkles size={14} /> You’re exploring a live demo</span><label>VIEW AS <select value={demoRole} onChange={(event) => { setDemoRole(event.target.value); setPage('overview') }} aria-label="Choose demo role"><option value="candidate">Candidate</option><option value="employer">Employer</option><option value="admin">Admin</option></select></label><button onClick={() => setModal('account')}>Create account <ArrowRight size={14} /></button></div>}

                <div className="page-content">
                    {page === 'overview' && role === 'candidate' && <CandidateOverview jobs={jobs} applications={currentApps} resumeSkills={resumeSkills} goTo={goTo} openResume={() => setModal('resume')} applyToJob={applyToJob} />}
                    {page === 'overview' && role === 'employer' && <EmployerOverview jobs={jobs} applications={currentApps} openJob={() => setModal('job')} goTo={goTo} isDemo={isDemo} />}
                    {page === 'overview' && role === 'admin' && <AdminOverview pendingJobs={pendingJobs} jobs={jobs} goTo={goTo} moderateJob={moderateJob} isDemo={isDemo} />}
                    {page === 'jobs' && <JobsPage role={role} jobs={role === 'employer' ? jobs.filter((job) => job.status !== 'rejected') : jobs} filteredJobs={filteredJobs} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} applications={applications} applyToJob={applyToJob} openJob={() => setModal('job')} resumeSkills={resumeSkills} />}
                    {page === 'applications' && <ApplicationsPage role={role} applications={currentApps} jobs={jobs} setApplications={setApplications} />}
                    {page === 'moderation' && <ModerationPage pendingJobs={pendingJobs} moderateJob={moderateJob} />}
                </div>
            </main>

            {notice && <div className="toast" role="status"><span className="toast-mark"><Check size={15} /></span>{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
            {modal && <Modal type={modal} onClose={() => setModal('')} onAuth={authenticate} onResume={parseResume} onCreateJob={createJob} busy={busy} apiOnline={apiOnline} />}
        </div>
    )
}

function PageHeading({ eyebrow, title, detail, action }) {
    return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{detail}</p></div>{action}</div>
}

function CandidateOverview({ jobs, applications, resumeSkills, goTo, openResume, applyToJob }) {
    const featured = jobs.slice(0, 3)
    return <>
        <PageHeading eyebrow="THURSDAY, OCTOBER 8, 2026" title={<>Find work that <span>moves you.</span></>} detail="Your next chapter starts with one good match." action={<button className="button button-dark" onClick={() => goTo('jobs')}>Explore jobs <ArrowRight size={15} /></button>} />
        <section className="candidate-hero"><div className="hero-copy"><div className="hero-kicker"><span className="live-dot" /> YOUR NEXT CHAPTER</div><h2>Good work.<br /><em>Better fit.</em></h2><p>Roles chosen for your experience, your ambition, and the way you want to work.</p><button className="button button-lime" onClick={() => goTo('jobs')}>See your matches <ArrowUpRight size={16} /></button><div className="hero-note"><span className="note-avatars"><i>JM</i><i>AL</i><i>+4k</i></span><span>People found their next role this month</span></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-sun" /><div className="hero-asterisk">✳</div><div className="hero-label label-one"><span className="label-icon label-mint"><ArrowUpRight size={15} /></span><span><b>96% match</b><small>Senior Product Designer</small></span></div><div className="hero-label label-two"><span className="label-icon label-coral"><BriefcaseBusiness size={15} /></span><span><b>3 new roles</b><small>Added for you today</small></span></div><div className="hero-tag">MADE FOR YOUR NEXT</div></div></section>
        <div className="section-heading"><div><div className="eyebrow">A GOOD PLACE TO START</div><h2>Picked for you <span className="heading-count">04</span></h2></div><button className="text-link" onClick={() => goTo('jobs')}>View all roles <ArrowRight size={15} /></button></div>
        <div className="job-grid job-grid-home">{featured.length ? featured.map((job) => <JobCard key={job.id} job={job} compact applyToJob={applyToJob} applied={applications.some((item) => item.jobId === job.id)} />) : <div className="empty-state"><b>No open roles yet.</b><p>Check back soon for new opportunities.</p></div>}</div>
        <section className="lower-grid"><div className="panel applications-panel"><div className="panel-heading"><div><div className="eyebrow">KEEP THE MOMENTUM</div><h3>Recent applications</h3></div><button className="icon-button" title="View applications" onClick={() => goTo('applications')}><ArrowUpRight size={17} /></button></div>{applications.length ? applications.slice(0, 3).map((application) => <ApplicationRow key={application.id} application={application} />) : <p className="empty-inline">Your applications will show up here.</p>}<button className="panel-link" onClick={() => goTo('applications')}>All applications <ArrowRight size={14} /></button></div><div className="resume-panel"><div className="resume-panel-top"><div className="resume-icon"><FileText size={19} /></div><span className="eyebrow">YOUR PROFILE</span></div><h3>{resumeSkills.length ? 'Your resume is working.' : 'A better match starts here.'}</h3><p>{resumeSkills.length ? `We found ${resumeSkills.length} skills and are using them to tailor your matches.` : 'Add a resume once. We’ll find the skills that open the right doors.'}</p>{resumeSkills.length ? <div className="skill-chips">{resumeSkills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div> : <button className="resume-link" onClick={openResume}><Upload size={15} /> Upload resume <ArrowRight size={14} /></button>}<span className="resume-scribble" aria-hidden="true">✳</span></div></section>
    </>
}

function EmployerOverview({ jobs, applications, openJob, goTo, isDemo }) {
    const activeJobs = jobs.filter((job) => job.status === 'active')
    const listedJobs = jobs.filter((job) => job.status !== 'rejected')
    const displayedJobs = listedJobs.length ? listedJobs : isDemo ? demoJobs.slice(0, 2) : []
    return <>
        <PageHeading eyebrow="EMPLOYER WORKSPACE" title={<>Build your <span>next team.</span></>} detail="Every great hire starts with a thoughtful listing." action={<button className="button button-dark" onClick={openJob}><Plus size={16} /> Post a role</button>} />
        <section className="employer-banner"><div><div className="hero-kicker"><span className="live-dot" /> STUDIO NORTH · HIRING</div><h2>Find the right<br /><em>kind of talent.</em></h2><p>Meet people who bring the skills and perspective your team needs.</p><button className="button button-lime" onClick={openJob}>Create a listing <ArrowUpRight size={15} /></button></div><div className="employer-stat"><span>LIVE LISTINGS</span><strong>{String(isDemo ? 2 : activeJobs.length).padStart(2, '0')}</strong><small>Across your team</small><div className="stat-line"><i /><i /><i /><i /><i /><i /><i /><i /></div></div><div className="employer-decoration" aria-hidden="true">✳</div></section>
        <div className="metric-grid"><Metric label="Active listings" value={String(isDemo ? 2 : activeJobs.length).padStart(2, '0')} delta={isDemo ? 'Across 3 teams' : 'Currently published'} icon={BriefcaseBusiness} tone="mint" /><Metric label="Total applicants" value={String(applications.length + (isDemo ? 38 : 0))} delta={isDemo ? '↑ 12% this month' : 'For your listings'} icon={Users} tone="coral" /><Metric label="Interviews booked" value={String(isDemo ? 8 : applications.filter((item) => item.status === 'interview').length).padStart(2, '0')} delta={isDemo ? 'Next: Product Designer' : 'Across your roles'} icon={ArrowUpRight} tone="yellow" /></div>
        <div className="section-heading section-heading-tight"><div><div className="eyebrow">YOUR OPEN ROLES</div><h2>Recent listings</h2></div><button className="text-link" onClick={() => goTo('jobs')}>Manage listings <ArrowRight size={15} /></button></div>
        <div className="listing-table">{displayedJobs.length ? displayedJobs.map((job, index) => <div className="listing-row" key={job.id}><div className={`company-mark mark-${job.color || 'ink'}`}>{job.initials || job.company[0]}</div><div className="listing-title"><b>{job.title}</b><span>{job.location}</span></div><span className="listing-applicants">{job.applicationCount ?? (isDemo ? [18, 12, 8][index % 3] : 0)} applicants</span><span className={`listing-status ${job.status === 'pending' ? 'listing-status-pending' : ''}`}><i />{job.status === 'pending' ? 'In review' : 'Live'}</span><button className="icon-button" title="View listing" onClick={() => goTo('applications')}><ArrowUpRight size={16} /></button></div>) : <div className="empty-state"><b>No listings yet.</b><p>Create a role to start building your pipeline.</p></div>}</div>
    </>
}

function AdminOverview({ pendingJobs, jobs, goTo, moderateJob, isDemo }) {
    return <>
        <PageHeading eyebrow="NORTHSTAR ADMIN" title={<>Keep the board <span>thoughtful.</span></>} detail="A clear view of activity, quality, and the community." action={<button className="button button-dark" onClick={() => goTo('moderation')}><ShieldCheck size={15} /> Review listings</button>} />
        <section className="admin-banner"><div><div className="hero-kicker"><span className="live-dot" /> PLATFORM HEALTH · GOOD</div><h2>A little care<br />goes a <em>long way.</em></h2><p>Review new listings so candidates see roles worth their time.</p></div><div className="admin-number"><strong>{String(pendingJobs.length).padStart(2, '0')}</strong><span>LISTINGS<br />NEED REVIEW</span></div><span className="admin-star" aria-hidden="true">✳</span></section>
        <div className="metric-grid"><Metric label="Live listings" value={String(jobs.filter((job) => job.status === 'active').length + (isDemo ? 124 : 0))} delta="Across all categories" icon={BriefcaseBusiness} tone="mint" /><Metric label="Pending review" value={String(pendingJobs.length).padStart(2, '0')} delta="Ready for a quick look" icon={ShieldCheck} tone="yellow" /><Metric label="New this week" value={isDemo ? '36' : '—'} delta={isDemo ? '↑ 8% from last week' : 'Current reporting period'} icon={ArrowUpRight} tone="coral" /></div>
        <div className="section-heading section-heading-tight"><div><div className="eyebrow">MODERATION QUEUE</div><h2>Needs your eye</h2></div><button className="text-link" onClick={() => goTo('moderation')}>Open queue <ArrowRight size={15} /></button></div>
        {pendingJobs.length ? <div className="moderation-preview">{pendingJobs.slice(0, 2).map((job) => <ModerationCard key={job.id} job={job} onAction={moderateJob} preview />)}</div> : <div className="empty-state"><span className="empty-icon"><Check size={20} /></span><b>All caught up.</b><p>New listings will appear here.</p></div>}
    </>
}

function JobsPage({ role, jobs, filteredJobs, query, setQuery, filter, setFilter, applications, applyToJob, openJob, resumeSkills }) {
    const isEmployer = role === 'employer'
    return <>
        <PageHeading eyebrow={isEmployer ? 'EMPLOYER WORKSPACE' : 'THE JOB BOARD'} title={isEmployer ? <>Your open <span>roles.</span></> : <>A role worth <span>the search.</span></>} detail={isEmployer ? 'See how your listings are finding the right people.' : `${jobs.length} thoughtful opportunities, with room to do your best work.`} action={isEmployer && <button className="button button-dark" onClick={openJob}><Plus size={16} /> Post a role</button>} />
        <div className="search-toolbar"><label className="search-field"><Search size={18} /><input aria-label="Search jobs" placeholder="Role, company, or keyword" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label><label className="filter-field"><Filter size={16} /><select aria-label="Filter by role type" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All roles</option><option>Full-time</option><option>Contract</option><option>Part-time</option><option>Remote</option></select><ChevronDown size={15} /></label></div>
        {!isEmployer && resumeSkills.length > 0 && <div className="match-notice"><Sparkles size={15} /> Matched against {resumeSkills.length} skills from your resume <button onClick={() => setFilter('All roles')}>Clear match filter <X size={13} /></button></div>}
        <div className="results-bar"><span>{filteredJobs.length} {filteredJobs.length === 1 ? 'role' : 'roles'} {query && <>for <b>“{query}”</b></>}</span><span>Sorted by relevance <ChevronDown size={14} /></span></div>
        {filteredJobs.length ? <div className="job-grid">{filteredJobs.map((job, index) => <JobCard key={job.id} job={job} applyToJob={applyToJob} applied={applications.some((item) => item.jobId === job.id)} featured={!index && !query} employer={isEmployer} />)}</div> : <div className="empty-state"><span className="empty-icon"><Search size={19} /></span><b>No roles found.</b><p>Try another keyword or role type.</p></div>}
    </>
}

function ApplicationsPage({ role, applications, jobs, setApplications }) {
    const employer = role === 'employer' || role === 'admin'
    const shown = applications.length ? applications : [{ id: 'empty-demo', status: '', date: '', job: null }]
    async function updateStatus(id, status) {
        const token = localStorage.getItem('job-portal-token')
        if (token && id !== 'empty-demo') {
            const response = await fetch(`/api/applications/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
            const data = await response.json()
            if (!response.ok) return window.alert(data.message || 'Status could not be updated.')
        }
        setApplications((items) => items.map((item) => item.id === id ? { ...item, status } : item))
    }
    return <>
        <PageHeading eyebrow={employer ? 'HIRING ACTIVITY' : 'YOUR JOB SEARCH'} title={employer ? <>Good people, <span>in progress.</span></> : <>Every step <span>counts.</span></>} detail={employer ? 'Keep track of every candidate and conversation.' : 'Keep an eye on the opportunities you have in motion.'} />
        <section className="applications-summary"><div><span>{employer ? 'CANDIDATES IN PIPELINE' : 'APPLICATIONS SENT'}</span><strong>{String(applications.length || (employer ? 12 : 0)).padStart(2, '0')}</strong></div><div className="summary-divider" /><div><span>{employer ? 'NEEDS REVIEW' : 'UNDER REVIEW'}</span><strong>{String(applications.filter((item) => item.status === 'reviewing' || item.status === 'submitted').length || (employer ? 4 : 0)).padStart(2, '0')}</strong></div><div className="summary-note">{employer ? 'A thoughtful response makes a difference.' : 'We’ll let you know when something changes.'}</div></section>
        <div className="section-heading section-heading-tight"><div><div className="eyebrow">{employer ? 'RECENT APPLICANTS' : 'YOUR ACTIVITY'}</div><h2>{employer ? 'Candidate pipeline' : 'Application history'}</h2></div><span className="sort-label">Newest first <ChevronDown size={14} /></span></div>
        <div className="application-list">{shown.map((application) => {
            const job = application.job || jobs.find((item) => item.id === application.jobId) || demoJobs.find((item) => item.id === application.jobId)
            if (!job) return <div key={application.id} className="empty-state empty-applications"><span className="empty-icon"><FileText size={19} /></span><b>No applications just yet.</b><p>Find a role that fits and take your first step.</p></div>
            return <div className="application-item" key={application.id}><div className={`company-mark mark-${job.color || 'ink'}`}>{job.initials || job.company?.[0]}</div><div className="application-role"><b>{job.title}</b><span>{job.company} <i /> {application.date}</span></div>{employer && <span className="candidate-preview">{application.candidate?.name || ['Taylor Kim', 'Morgan Chen'][Math.abs(application.id.length) % 2]}<small>{(application.candidate?.skills || ['Product strategy', 'Research']).slice(0, 2).join(' · ')}</small></span>}<span className={`status-pill status-${application.status || 'submitted'}`}><i />{application.status || 'submitted'}</span>{employer && <select aria-label={`Update ${job.title} application status`} value={application.status || 'submitted'} onChange={(event) => updateStatus(application.id, event.target.value)}><option value="submitted">Submitted</option><option value="reviewing">Reviewing</option><option value="interview">Interview</option><option value="rejected">Rejected</option><option value="accepted">Accepted</option></select>}<button className="icon-button" title="View application" onClick={() => window.alert(`${job.title} · ${application.status || 'submitted'}`)}><ArrowUpRight size={16} /></button></div>
        })}</div>
    </>
}

function ModerationPage({ pendingJobs, moderateJob }) {
    return <>
        <PageHeading eyebrow="COMMUNITY STANDARDS" title={<>The board stays <span>better.</span></>} detail="Review each listing before it reaches job seekers." action={<span className="queue-badge"><i /> {pendingJobs.length} waiting</span>} />
        <div className="moderation-intro"><ShieldCheck size={17} /><span>Look for clear role details, transparent compensation, and a real employer behind every listing.</span></div>
        {pendingJobs.length ? <div className="moderation-list">{pendingJobs.map((job) => <ModerationCard key={job.id} job={job} onAction={moderateJob} />)}</div> : <div className="empty-state"><span className="empty-icon"><Check size={20} /></span><b>All caught up.</b><p>There are no listings waiting for review.</p></div>}
    </>
}

function ModerationCard({ job, onAction, preview = false }) {
    return <article className={`moderation-card ${preview ? 'moderation-card-preview' : ''}`}><div className="moderation-card-top"><div className={`company-mark mark-${job.color || 'ink'}`}>{job.initials || job.company[0]}</div><span className="pending-label"><i /> Pending review</span><span className="moderation-time">{job.posted || 'Submitted today'}</span></div><h3>{job.title}</h3><p className="moderation-company">{job.company} <i /> {job.location}</p>{!preview && <><p className="moderation-description">{job.description}</p><div className="skill-chips">{(job.skills || []).map((skill) => <span key={skill}>{skill}</span>)}</div></>}<div className="moderation-actions"><button className="button button-outline" onClick={() => onAction(job, 'rejected')}><X size={14} /> Reject</button><button className="button button-dark" onClick={() => onAction(job, 'active')}><Check size={14} /> Approve listing</button></div></article>
}

function Metric({ label, value, delta, icon: Icon, tone }) {
    return <div className="metric-card"><div className={`metric-icon metric-${tone}`}><Icon size={17} /></div><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-delta">{delta}</span></div>
}

function JobCard({ job, compact = false, applyToJob, applied, featured = false, employer = false }) {
    return <article className={`job-card ${featured ? 'job-card-featured' : ''} ${compact ? 'job-card-compact' : ''}`}><div className="job-card-top"><div className={`company-mark mark-${job.color || 'ink'}`}>{job.initials || job.company?.[0]}</div><span className="posted-label">{job.posted || 'Just added'}</span></div>{job.match && <span className="match-label"><Sparkles size={12} /> {job.match}% match</span>}<h3>{job.title}</h3><div className="job-company">{job.company}<i /> {job.type}</div><div className="job-location"><MapPin size={13} /> {job.location}</div><div className="job-skills">{(job.skills || []).slice(0, compact ? 3 : 4).map((skill) => <span key={skill}>{skill}</span>)}</div><div className="job-card-footer"><div><b>{job.salary}</b><small>annual salary</small></div>{employer ? <span className={`listing-status ${job.status === 'pending' ? 'listing-status-pending' : ''}`}><i />{job.status === 'pending' ? 'In review' : 'Live'}</span> : <button className={`apply-button ${applied ? 'applied-button' : ''}`} onClick={() => applyToJob(job)} title={applied ? 'Already applied' : `Apply for ${job.title}`}>{applied ? <Check size={16} /> : <ArrowUpRight size={16} />}</button>}</div></article>
}

function ApplicationRow({ application }) {
    const job = application.job
    if (!job) return null
    return <div className="recent-app-row"><div className={`company-mark mark-${job.color || 'ink'}`}>{job.initials || job.company[0]}</div><div className="recent-app-copy"><b>{job.title}</b><span>{job.company}</span></div><span className={`status-pill status-${application.status}`}><i />{application.status}</span></div>
}

function Modal({ type, onClose, onAuth, onResume, onCreateJob, busy, apiOnline }) {
    const [mode, setMode] = useState('login')
    const [error, setError] = useState('')
    const isSignup = mode === 'register'
    const headings = { account: ['Welcome back.', 'Sign in to keep your search moving.'], resume: ['Show us your story.', 'We’ll find the skills that lead to a better match.'], job: ['Put a good role out there.', 'The right person might be looking today.'], help: ['A little help?', 'Reach our team at hello@northstar.jobs.'], settings: ['Your preferences.', 'Manage your workspace and profile settings.'] }
    const [title, description] = headings[type] || headings.account

    async function handleResume(event) {
        event.preventDefault()
        try { await onResume(event.currentTarget.elements.resume.files[0]) } catch (caught) { setError(caught.message || 'This resume could not be analyzed.') }
    }

    async function connectLinkedIn(event) {
        event.preventDefault()
        setError('')
        if (!apiOnline) {
            setError('LinkedIn import needs the API, MongoDB, and LinkedIn app credentials. You can create a local demo profile or continue as a guest.')
            return
        }
        try {
            const response = await fetch('/api/auth/linkedin/status')
            const status = await response.json()
            if (!response.ok || !status.configured) throw new Error('Add LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_REDIRECT_URI to .env, then restart the API.')
            window.location.assign('/api/auth/linkedin')
        } catch (caught) {
            setError(caught.message || 'LinkedIn import is not configured yet.')
        }
    }

    return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button><div className="modal-symbol">{type === 'resume' ? <FileText size={20} /> : type === 'job' ? <BriefcaseBusiness size={20} /> : <Sparkles size={20} />}</div><div className="eyebrow">NORTHSTAR · {type === 'job' ? 'NEW LISTING' : type === 'resume' ? 'PROFILE' : 'YOUR WORKSPACE'}</div><h2 id="modal-title">{type === 'account' && isSignup ? 'Make your next move.' : title}</h2><p className="modal-description">{type === 'account' && isSignup ? 'Create a free account and keep everything in one place.' : description}</p>{error && <div className="form-error">{error}</div>}
        {type === 'account' && <><form className="modal-form" action="/api/auth/login" onSubmit={(event) => { event.preventDefault(); onAuth(new FormData(event.currentTarget)) }}><input type="hidden" name="mode" value={mode} />{isSignup && <label>Your name<input name="name" placeholder="Sam Rivera" required /></label>}<label>Email address<input type="email" name="email" placeholder="you@example.com" required /></label><label>Password<input type="password" name="password" minLength="8" placeholder={isSignup ? 'At least 8 characters' : 'Your password'} required /></label>{isSignup && <><label>I’m here as<select name="role"><option value="candidate">A candidate</option><option value="employer">An employer</option></select></label><label>Company name <span className="optional-label">for employers</span><input name="company" placeholder="Studio North" /></label></>}<button className="button button-dark modal-submit" disabled={busy}>{busy ? 'One moment…' : isSignup ? apiOnline ? 'Create your account' : 'Create demo profile' : 'Sign in'} <ArrowRight size={15} /></button></form><button className="mode-toggle" onClick={() => { setMode(isSignup ? 'login' : 'register'); setError('') }}>{isSignup ? 'Already have an account? Sign in' : 'New to Northstar? Create an account'}</button><button className="mode-toggle" onClick={onClose}>Continue as guest without an account</button><button type="button" className="linkedin-button" onClick={connectLinkedIn}><span>in</span> Continue with LinkedIn <ArrowUpRight size={14} /></button><p className="api-note">{apiOnline ? 'LinkedIn sign-in requires an approved LinkedIn app.' : 'Demo profiles stay on this device. No account is needed to browse or apply.'}</p></>}
        {type === 'resume' && <form className="modal-form" onSubmit={handleResume}><label className="upload-zone"><Upload size={22} /><b>Choose a resume file</b><span>PDF or plain text · up to 5 MB</span><input type="file" name="resume" accept=".pdf,.txt,application/pdf,text/plain" required /></label><button className="button button-dark modal-submit">Analyze my resume <ArrowRight size={15} /></button></form>}
        {type === 'job' && <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onCreateJob(event.currentTarget) }}><label>Role title<input name="title" placeholder="Senior Product Designer" required /></label><div className="form-pair"><label>Company<input name="company" placeholder="Studio North" required /></label><label>Location<input name="location" placeholder="Remote · US" required /></label></div><div className="form-pair"><label>Employment type<select name="type"><option>Full-time</option><option>Contract</option><option>Part-time</option><option>Remote</option></select></label><label>Salary range<input name="salary" placeholder="$130k – $160k" /></label></div><label>Skills <span className="optional-label">comma separated</span><input name="skills" placeholder="React, Figma, Product strategy" /></label><label>About the role<textarea name="description" placeholder="What will this person make possible?" rows="3" required /></label><button className="button button-dark modal-submit">Submit listing <ArrowRight size={15} /></button></form>}
        {type === 'help' && <div className="help-content"><p>Questions about your search or a listing? Our team is happy to help.</p><a href="mailto:hello@northstar.jobs" className="button button-dark">Email the team <ArrowRight size={15} /></a></div>}{type === 'settings' && <div className="help-content"><p>Profile preferences and notifications are managed from your account. Sign in to update your details.</p><button className="button button-dark" onClick={onClose}>Done <Check size={15} /></button></div>}
    </section></div>
}

export default App