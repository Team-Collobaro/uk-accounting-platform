'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BookOpen, Briefcase, ChevronDown, Download, GraduationCap, Globe, Menu, Search, X } from 'lucide-react'
import { mobileAppDownload } from '@/lib/mobileAppDownload'

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const primaryLinks = [
    { label: 'Students', href: '/login', active: true },
    { label: 'Alumni', href: '#credentials' },
    { label: 'Employers', href: '/employer' },
    { label: 'Library', href: '#features' },
    { label: 'Online', href: '/login' },
  ]

  const studentLinks = [
    { label: 'New students', href: '#about' },
    { label: 'My course', href: '/courses' },
    { label: 'Support & services', href: '#features' },
    { label: 'Student life', href: '#credentials' },
    { label: 'Careers & opportunities', href: '#credentials' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa', color: '#1a1a1a' }}>
      {/* ── University-style Navbar ── */}
      <header className="site-header">
        <div className="top-nav">
          <Link href="/" className="brand-block" aria-label="UKATI home">
            <Image src="/ukati-logo.jpg" alt="UKATI Logo" width={130} height={74} className="brand-logo" priority />
          </Link>

          <button className="campus-selector" type="button">
            UKATI Online <ChevronDown size={18} />
          </button>

          <nav className="primary-nav" aria-label="Primary">
            {primaryLinks.map((link) => (
              <Link key={link.label} href={link.href} className={link.active ? 'primary-link active' : 'primary-link'}>
                {link.label}
              </Link>
            ))}
            <button className="search-button" type="button" aria-label="Search">
              <Search size={23} />
            </button>
          </nav>

          <button className="mobile-menu-button" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu">
            {isMenuOpen ? <X size={30} /> : <Menu size={30} />}
          </button>
        </div>

        <nav className="secondary-nav" aria-label="Student navigation">
          {studentLinks.map((link) => (
            <Link key={link.label} href={link.href} className="secondary-link">
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)', position: 'sticky', top: 74, zIndex: 49, boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}
            className="md-hidden"
          >
            <div style={{ padding: '20px 5%', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[...primaryLinks, ...studentLinks].map((link) => (
                <a key={link.label} href={link.href} onClick={() => setIsMenuOpen(false)} style={{ textDecoration: 'none', color: '#0F4A5C', fontWeight: 700, fontSize: 16, padding: '8px 0', borderBottom: '1px solid rgba(15,74,92,0.10)', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                  {link.label}
                </a>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                <Link href="/login" onClick={() => setIsMenuOpen(false)} style={{ textDecoration: 'none' }}>
                  <button style={{ width: '100%', padding: '12px', borderRadius: 8, background: 'rgba(15,74,92,0.08)', color: '#0F4A5C', fontWeight: 800, border: 'none', fontSize: 15, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                    Sign In
                  </button>
                </Link>
                <Link href="/register" onClick={() => setIsMenuOpen(false)} style={{ textDecoration: 'none' }}>
                  <button style={{ width: '100%', padding: '12px', borderRadius: 8, background: '#C79A2B', color: '#071116', fontWeight: 800, border: 'none', fontSize: 15, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                    Register
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .site-header {
          --ukati-navy: #073647;
          --ukati-navy-dark: #052B39;
          --ukati-navy-soft: #EAF1F3;
          --ukati-gold: #B88A22;
          --ukati-gold-soft: #F4E6BD;
          position: sticky;
          top: 0;
          z-index: 50;
          background: #fff;
          box-shadow: 0 2px 14px rgba(0,0,0,0.08);
        }
        .top-nav {
          height: 74px;
          display: flex;
          align-items: stretch;
          background: var(--ukati-navy);
          padding-left: 12.3%;
        }
        .brand-block {
          width: 166px;
          height: 90px;
          margin-top: 0;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          border-bottom: 4px solid var(--ukati-gold);
          box-shadow: 0 3px 10px rgba(5,43,57,0.16);
          z-index: 2;
        }
        .brand-logo {
          width: 132px;
          height: 76px;
          object-fit: contain;
        }
        .campus-selector {
          display: flex;
          align-items: center;
          gap: 14px;
          border: 0;
          background: transparent;
          color: #fff;
          padding: 0 30px;
          font-family: Montserrat, system-ui, sans-serif;
          font-size: 20px;
          font-weight: 800;
          line-height: 1;
          cursor: pointer;
        }
        .primary-nav {
          margin-left: auto;
          display: flex;
          align-items: stretch;
          padding-right: 13.2%;
        }
        .primary-link {
          display: flex;
          align-items: center;
          padding: 0 18px;
          color: #fff;
          text-decoration: none;
          font-family: Montserrat, system-ui, sans-serif;
          font-size: 17px;
          font-weight: 700;
          line-height: 1;
        }
        .primary-link.active {
          background: #fff;
          color: var(--ukati-navy);
        }
        .primary-link:hover,
        .search-button:hover,
        .campus-selector:hover {
          color: var(--ukati-gold-soft);
        }
        .search-button,
        .mobile-menu-button {
          border: 0;
          background: transparent;
          color: #fff;
          padding: 0 22px;
          cursor: pointer;
        }
        .secondary-nav {
          height: 92px;
          display: flex;
          align-items: stretch;
          justify-content: center;
          background: #f5f5f3;
          border-bottom: 1px solid rgba(7,54,71,0.16);
        }
        .secondary-link {
          display: flex;
          align-items: center;
          padding: 0 34px;
          color: var(--ukati-navy);
          text-decoration: none;
          font-family: Montserrat, system-ui, sans-serif;
          font-size: 21px;
          font-weight: 800;
          line-height: 1;
          border-left: 1px solid transparent;
          border-right: 1px solid transparent;
        }
        .secondary-link:hover {
          color: #071116;
          background: var(--ukati-navy-soft);
          text-decoration: underline;
          text-decoration-color: var(--ukati-gold);
          text-decoration-thickness: 3px;
          text-underline-offset: 7px;
        }
        .secondary-link.active {
          background: #fff;
          text-decoration: underline;
          text-decoration-color: var(--ukati-gold);
          text-decoration-thickness: 3px;
          text-underline-offset: 7px;
          border-left-color: rgba(7,54,71,0.18);
          border-right-color: rgba(7,54,71,0.18);
        }
        .mobile-menu-button {
          display: none;
          margin-left: auto;
        }
        @media (min-width: 768px) {
          .md-hidden { display: none !important; }
        }
        @media (max-width: 767px) {
          .site-header { position: sticky; top: 0; }
          .top-nav {
            height: 74px;
            padding-left: 0;
          }
          .brand-block {
            width: 132px;
            height: 74px;
            box-shadow: none;
          }
          .brand-logo {
            width: 106px;
            height: 60px;
          }
          .campus-selector,
          .primary-nav,
          .secondary-nav {
            display: none;
          }
          .mobile-menu-button {
            display: block;
          }
          .md-flex { display: none !important; }
        }
        @media (max-width: 900px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
          }
          .hero-spacer {
            display: none !important;
          }
          .hero-hmrc-mark {
            opacity: 0.06 !important;
            right: -210px !important;
            width: 560px !important;
          }
          .credential-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 560px) {
          .credential-row {
            grid-template-columns: 1fr !important;
          }
          .credential-badge {
            min-height: 96px;
          }
        }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* ── Hero Section ── */}
      <section style={{ padding: '84px 5% 88px', background: '#F8F8F5', color: '#073647', position: 'relative', overflow: 'hidden', borderBottom: '1px solid rgba(7,54,71,0.10)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, #FFFFFF 0%, #F8F8F5 58%, #EAF1F3 100%)' }} />
        <Image className="hero-hmrc-mark" src="/hmrc-emblem.png" alt="" width={960} height={540} priority
          style={{ position: 'absolute', right: -300, top: '50%', transform: 'translateY(-50%)', width: 900, height: 'auto', opacity: 0.075, objectFit: 'contain', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1120, margin: '0 auto', position: 'relative' }}>
          <motion.div initial={{ opacity: 0, x: -26 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <h2 style={{ fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: 'clamp(34px, 4.6vw, 56px)', fontWeight: 900, lineHeight: 1.12, margin: '0 0 28px 0', color: '#073647', letterSpacing: 0, maxWidth: 720 }}>
              Your Pathway to a Rewarding Career in <span style={{ color: '#B88A22' }}>Global Accounting</span>
            </h2>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <Link href="/register" style={{ textDecoration: 'none' }}>
                <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                  style={{ padding: '15px 23px', borderRadius: 6, background: '#B88A22', color: '#071116', fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  Enrol Today <ArrowRight size={18} />
                </motion.button>
              </Link>
              <Link href="/courses" style={{ textDecoration: 'none', color: '#073647', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 2px' }}>
                View Courses <ArrowRight size={17} />
              </Link>
              <a
                href={mobileAppDownload.url}
                style={{ textDecoration: 'none', color: '#073647', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 2px' }}
                aria-label={`Download LMS Mobile ${mobileAppDownload.version} for ${mobileAppDownload.platform}`}
              >
                <Download size={18} /> Download Android Beta
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── About Section ── */}
      <section id="about" style={{ padding: '80px 5%', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 60, alignItems: 'center' }}>
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <h3 style={{ fontSize: 14, color: '#BA923A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 12px 0' }}>About Us</h3>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: '#1A365D', margin: '0 0 24px 0', lineHeight: 1.3 }}>
              Team Collaboro & UKATI
            </h2>
            <p style={{ color: '#4a4a4a', lineHeight: 1.8, margin: '0 0 20px 0', fontSize: 16 }}>
              <strong>Team Collaboro Pvt Ltd</strong> is a strategic delegation partner for UK-based accountancy and tax firms, providing compliance, advisory, and HMRC tax investigation assistance through our professional team in Sri Lanka.
            </p>
            <p style={{ color: '#4a4a4a', lineHeight: 1.8, margin: 0, fontSize: 16 }}>
              Drawing on this real-world expertise and months of dedicated research, we have developed an industry-focused UK accounting and taxation curriculum, proudly delivered through <strong>UKATI</strong> — our wholly owned training institute.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} style={{ display: 'flex', justifyContent: 'center' }}>
             <div style={{ background: '#f8f9fa', padding: 40, borderRadius: 16, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 10px 30px rgba(26, 54, 93, 0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
               <Image src="/ukati-logo.jpg" alt="UKATI Logo" width={200} height={200} style={{ objectFit: 'contain', margin: '0 0 20px 0', mixBlendMode: 'multiply' }} />
               <h4 style={{ color: '#1A365D', fontWeight: 700, fontSize: 20, margin: '0 0 8px 0' }}>UK Accounting & Taxation Institute</h4>
               <p style={{ color: '#6b6b6b', fontSize: 14, margin: 0 }}>A Team Collaboro Initiative</p>
             </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" style={{ padding: '80px 5%', background: '#f8f9fa' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
             <h2 style={{ fontSize: 32, fontWeight: 800, color: '#1A365D', margin: 0 }}>Why Choose UKATI?</h2>
             <div style={{ width: 60, height: 4, background: '#BA923A', margin: '20px auto 0', borderRadius: 2 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 30 }}>
            {[
              {
                icon: <Briefcase size={32} color="#BA923A" />,
                title: 'Real-World Expertise',
                desc: 'Learn compliance, advisory, and HMRC tax investigation directly from practicing professionals.'
              },
              {
                icon: <BookOpen size={32} color="#BA923A" />,
                title: 'Industry-Focused Curriculum',
                desc: 'A specialized curriculum developed through months of research to meet UK market demands.'
              },
              {
                icon: <Globe size={32} color="#BA923A" />,
                title: 'Global Career Opportunities',
                desc: 'Take your first step towards a rewarding career in the global accounting sector from Sri Lanka.'
              },
              {
                icon: <GraduationCap size={32} color="#BA923A" />,
                title: 'Professional Standards',
                desc: 'Develop the elite skills and rigorous professional standards required by UK-based accountancy firms.'
              }
            ].map((feature, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                style={{ background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.02)' }}>
                <div style={{ margin: '0 0 20px 0', width: 64, height: 64, borderRadius: 12, background: 'rgba(186,146,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {feature.icon}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1A365D', margin: '0 0 12px 0' }}>{feature.title}</h3>
                <p style={{ color: '#6b6b6b', lineHeight: 1.6, fontSize: 14, margin: 0 }}>{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Credential Ladder Section ── */}
      <section id="credentials" style={{ padding: '88px 5%', background: '#fff' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.75fr) minmax(0, 1.6fr)', gap: 34, alignItems: 'stretch' }} className="credential-grid">
            <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              style={{ background: '#073647', color: '#fff', borderRadius: 10, padding: 34, position: 'relative', overflow: 'hidden', minHeight: 420 }}>
              <div style={{ position: 'absolute', right: -70, top: -70, width: 190, height: 190, borderRadius: '50%', border: '28px solid rgba(184,138,34,0.28)' }} />
              <p style={{ margin: '0 0 10px', color: '#F4E6BD', fontSize: 12, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                Credential Pathway
              </p>
              <h2 style={{ fontSize: 36, lineHeight: 1.12, fontWeight: 800, margin: '0 0 18px', color: '#fff' }}>
                The Credential Ladder
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.75, fontSize: 16, margin: '0 0 28px' }}>
                Students can progress from foundation accounting capability to supervised practice and then advanced advisory specialisation.
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                {['Tracked in platform', 'Proctored assessment', 'One-time awards'].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff', fontWeight: 700, fontSize: 14 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: '#B88A22', flexShrink: 0 }} />
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            <div style={{ display: 'grid', gap: 18 }}>
              {[
                {
                  stage: 'Stage 01',
                  title: 'Associate UK Accounting Technician',
                  initials: 'AUKAT',
                  awardedOn: 'Complete the syllabus and pass the proctored exam.',
                  detail: 'Recommended pass mark: 70%+',
                },
                {
                  stage: 'Stage 02',
                  title: 'Certified UK Accounting Practitioner',
                  initials: 'CUKAP',
                  awardedOn: 'Complete supervised work at an Approved Training Practice.',
                  detail: 'Evidence: employer service letter plus closing knowledge interview.',
                },
                {
                  stage: 'Advanced',
                  title: 'Senior UK Tax & Advisory Practitioner',
                  initials: 'SUKTAP',
                  awardedOn: 'Complete the advanced Virtual CFO / Tax Investigations tier.',
                  detail: 'Designed for students moving into advisory-facing work.',
                },
              ].map((cred, i) => (
                <motion.div key={cred.initials} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="credential-row"
                  style={{ display: 'grid', gridTemplateColumns: '112px minmax(0, 1fr)', gap: 18, alignItems: 'stretch', background: '#F8F8F5', border: '1px solid rgba(7,54,71,0.12)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 30px rgba(7,54,71,0.06)' }}>
                  <div className="credential-badge" style={{ background: i === 1 ? '#B88A22' : '#073647', color: '#fff', padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.78 }}>{cred.stage}</span>
                    <strong style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.02em' }}>{cred.initials}</strong>
                  </div>
                  <div style={{ padding: '20px 22px' }}>
                    <h3 style={{ color: '#073647', fontSize: 21, lineHeight: 1.25, margin: '0 0 10px', fontWeight: 800 }}>{cred.title}</h3>
                    <p style={{ color: '#303A3F', fontSize: 14.5, lineHeight: 1.55, margin: '0 0 9px', fontWeight: 700 }}>{cred.awardedOn}</p>
                    <p style={{ color: '#667278', fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{cred.detail}</p>
                  </div>
                </motion.div>
              ))}

              <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: '#FFF9E9', border: '1px solid rgba(184,138,34,0.30)', padding: 18, borderRadius: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 99, background: '#B88A22', color: '#071116', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0 }}>i</div>
                <p style={{ color: '#073647', margin: 0, fontSize: 14.5, lineHeight: 1.65, fontWeight: 600 }}>
                  There is no ongoing membership or renewal. Each stage is a one-time award, so a candidate can stop at Stage 1 or continue through all three.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: '#052B39', color: '#fff', padding: '60px 5% 20px', borderTop: '5px solid #B88A22' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40, marginBottom: 60 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Image src="/ukati-logo.jpg" alt="UKATI Logo" width={46} height={46} style={{ objectFit: 'contain', background: '#fff', borderRadius: 4, padding: 5 }} />
                <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>UKATI</h2>
              </div>
              <p style={{ color: 'rgba(244,246,246,0.72)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                A wholly owned training institute by Team Collaboro Pvt Ltd, Sri Lanka.
              </p>
            </div>
            <div>
              <h4 style={{ fontWeight: 800, margin: '0 0 20px 0', color: '#F4E6BD' }}>Quick Links</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Link href="#about" style={{ color: 'rgba(244,246,246,0.82)', textDecoration: 'none', fontSize: 14 }}>About Us</Link>
                <Link href="#features" style={{ color: 'rgba(244,246,246,0.82)', textDecoration: 'none', fontSize: 14 }}>Why UKATI</Link>
                <Link href="#credentials" style={{ color: 'rgba(244,246,246,0.82)', textDecoration: 'none', fontSize: 14 }}>Credentials</Link>
                <Link href="/login" style={{ color: 'rgba(244,246,246,0.82)', textDecoration: 'none', fontSize: 14 }}>Sign In</Link>
              </div>
            </div>
            <div>
              <h4 style={{ fontWeight: 800, margin: '0 0 20px 0', color: '#F4E6BD' }}>Contact Us</h4>
              <p style={{ color: 'rgba(244,246,246,0.82)', fontSize: 14, margin: '0 0 8px 0' }}>info@ukati.lk</p>
              <p style={{ color: 'rgba(244,246,246,0.82)', fontSize: 14, margin: 0 }}>Sri Lanka</p>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(244,230,189,0.16)', paddingTop: 20, textAlign: 'center' }}>
            <p style={{ color: 'rgba(244,246,246,0.52)', fontSize: 12, margin: 0 }}>
              © {new Date().getFullYear()} Team Collaboro Pvt Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
