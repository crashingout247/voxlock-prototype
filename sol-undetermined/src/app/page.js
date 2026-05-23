'use client'; 
import { useState, useEffect } from 'react';
// IMPORT FIREBASE TOOLS
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

const INITIAL_POSTS = [
  // --- ASTRONOMY ---
  { id: 1, title: 'The Anatomy of a Star', author: 'Penelope', date: 'PHASE 01', topic: 'Astronomy', galaxyX: '25%', galaxyY: '35%', topicX: '35%', topicY: '30%' },
  { id: 2, title: 'Nebula Birthplaces', author: 'Penelope', date: 'PHASE 04', topic: 'Astronomy', galaxyX: '45%', galaxyY: '35%', topicX: '45%', topicY: '25%' },
  { id: 3, title: 'The Red Giant Phase', author: 'Astro-Team', date: 'PHASE 09', topic: 'Astronomy', galaxyX: '65%', galaxyY: '35%', topicX: '55%', topicY: '45%' },
  { id: 4, title: 'Solar Wind Anomalies', author: 'Penelope', date: 'PHASE 12', topic: 'Astronomy', galaxyX: '35%', galaxyY: '32%', topicX: '35%', topicY: '50%' },
  
  // --- MYTHOLOGY ---
  { id: 5, title: 'Myth of the Long Night', author: 'Anonymous', date: 'ERA II', topic: 'Mythology', galaxyX: '15%', galaxyY: '55%', topicX: '65%', topicY: '30%' },
  { id: 6, title: 'Orion’s Hidden Truth', author: 'Clara', date: 'ERA IV', topic: 'Mythology', galaxyX: '25%', galaxyY: '55%', topicX: '75%', topicY: '50%' },
  { id: 7, title: 'Cosmic Folklore', author: 'Clara', date: 'ERA V', topic: 'Mythology', galaxyX: '35%', galaxyY: '55%', topicX: '60%', topicY: '65%' },

  // --- LAW & JUSTICE ---
  { id: 8, title: 'Justice in the Void', author: 'Editorial Team', date: 'DOC. 88', topic: 'Law & Justice', galaxyX: '45%', galaxyY: '55%', topicX: '30%', topicY: '65%' },
  { id: 9, title: 'The Galactic Charter', author: 'Legal Mind', date: 'DOC. 91', topic: 'Law & Justice', galaxyX: '55%', galaxyY: '55%', topicX: '20%', topicY: '75%' },

  // --- UNSOLVED ---
  { id: 10, title: 'Unsolved: The Dark Matter', author: 'Penelope', date: 'CASE 07', topic: 'Unsolved', galaxyX: '65%', galaxyY: '55%', topicX: '20%', topicY: '40%' },
  { id: 11, title: 'The Wow! Signal of 1977', author: 'Guest Writer', date: 'CASE 09', topic: 'Unsolved', galaxyX: '75%', galaxyY: '55%', topicX: '25%', topicY: '65%' },
  { id: 12, title: 'Black Hole Anomalies', author: 'Penelope', date: 'CASE 14', topic: 'Unsolved', galaxyX: '85%', galaxyY: '55%', topicX: '15%', topicY: '50%' },

  // --- HISTORY ---
  { id: 13, title: 'Echoes of History', author: 'Guest Writer', date: 'LOG 404', topic: 'History', galaxyX: '40%', galaxyY: '58%', topicX: '45%', topicY: '75%' },
  { id: 14, title: 'Lost Records of the Sky', author: 'History Hub', date: 'LOG 512', topic: 'History', galaxyX: '60%', galaxyY: '58%', topicX: '55%', topicY: '85%' },

  // --- NEW TOPICS ---
  { id: 15, title: 'Bio-Resonance in Zero G', author: 'Dr. Vita', date: 'MED 01', topic: 'Sciences & Medicine', galaxyX: '20%', galaxyY: '75%', topicX: '50%', topicY: '40%' },
  { id: 16, title: 'The Quantum Engine', author: 'Tech Team', date: 'V 2.0', topic: 'Technology', galaxyX: '80%', galaxyY: '30%', topicX: '60%', topicY: '50%' },
  { id: 17, title: 'Isolation and the Void', author: 'Dr. Mind', date: 'PSY 04', topic: 'Psychology', galaxyX: '70%', galaxyY: '75%', topicX: '40%', topicY: '60%' },
];

const TOPICS_LIST = [
  'Astronomy', 'Mythology', 'Law & Justice', 'History', 'Literature', 
  'Politics', 'Unsolved', 'Sciences & Medicine', 'Technology', 'Psychology'
];

export default function Home() {
  const [posts, setPosts] = useState(INITIAL_POSTS);
  
  const [hoveredPost, setHoveredPost] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [activeTopic, setActiveTopic] = useState(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [adminMode, setAdminMode] = useState(false);
  const [adminStep, setAdminStep] = useState('idle');
  const [newEntry, setNewEntry] = useState({ topic: '', x: '', y: '', title: '', author: '', date: '' });
  const [placementError, setPlacementError] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  const activePosts = posts.filter(post => post.topic === activeTopic);

  // --- NEW: FETCH FROM FIREBASE ON LOAD ---
  useEffect(() => {
    const fetchCloudStars = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "stars"));
        const cloudStars = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id // Use Firebase's unique ID
        }));
        
        // Merge hardcoded stars with cloud stars
        setPosts([...INITIAL_POSTS, ...cloudStars]);
      } catch (error) {
        console.error("Error fetching from Firebase:", error);
      }
    };

    fetchCloudStars();
  }, []);

  const handleCanvasClick = (e) => {
    if (!adminMode || adminStep !== 'place') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const MIN_DISTANCE = 6; 
    let isTooClose = false;

    for (let post of posts) {
      const postX = parseFloat(activeTopic ? post.topicX : post.galaxyX);
      const postY = parseFloat(activeTopic ? post.topicY : post.galaxyY);
      const distance = Math.sqrt(Math.pow(clickX - postX, 2) + Math.pow(clickY - postY, 2));
      
      if (distance < MIN_DISTANCE) {
        if (activeTopic && post.topic === activeTopic) {
           isTooClose = true;
           break;
        } else if (!activeTopic) {
           isTooClose = true;
           break;
        }
      }
    }

    if (isTooClose) {
      setPlacementError('WARNING: Sector too crowded. Star is too close to an existing coordinate.');
    } else {
      setPlacementError('');
      setNewEntry({ ...newEntry, x: clickX.toFixed(2), y: clickY.toFixed(2) });
      setAdminStep('content');
    }
  };

  // --- UPDATED: SAVE TO FIREBASE ---
  const handleCreateStar = async (e) => {
    e.preventDefault();
    
    const finalNewPost = {
      title: newEntry.title,
      author: newEntry.author,
      date: newEntry.date,
      topic: newEntry.topic,
      galaxyX: `${newEntry.x}%`,
      galaxyY: `${newEntry.y}%`,
      topicX: `${newEntry.x}%`, 
      topicY: `${newEntry.y}%`
    };

    try {
      // 1. Push to Cloud Database
      const docRef = await addDoc(collection(db, "stars"), finalNewPost);
      
      // 2. Add to Local State instantly so it appears without refreshing
      setPosts([...posts, { ...finalNewPost, id: docRef.id }]);
      
      setGeneratedCode('SYSTEM MESSAGE: Star uploaded and saved to Firebase successfully!');
      setAdminStep('success');
    } catch (error) {
      console.error("Error saving star:", error);
      setPlacementError('Failed to save to cloud. Check console for details.');
    }
  };

  const handleAdminLogin = () => {
    if (passwordInput === 'Peacarrotcorn05*') {
      setAdminMode(true);
      setShowLoginPrompt(false);
      setPasswordInput('');
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  return (
    <main style={{ backgroundColor: '#05050A', color: '#DEFF9A', minHeight: '100vh', display: 'flex', fontFamily: 'serif' }}>
      
      <style>{`
        @keyframes twinkle {
          0%, 100% { box-shadow: 0 0 15px #DEFF9A, 0 0 30px rgba(222, 255, 154, 0.4); opacity: 1; }
          50% { box-shadow: 0 0 5px #DEFF9A, 0 0 10px rgba(222, 255, 154, 0.1); opacity: 0.6; }
        }
        @keyframes fadeInLine {
          from { opacity: 0; stroke-dashoffset: 100; }
          to { opacity: 0.4; stroke-dashoffset: 0; }
        }
        .orientation-shield { display: none; }
        @media (max-width: 900px) and (orientation: portrait) {
          .orientation-shield { display: flex !important; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: #05050A; z-index: 9999; flex-direction: column; justify-content: center; align-items: center; padding: 40px; text-align: center; }
          .main-archive-interface { display: none !important; }
        }
        .admin-input { background: #0A0E17; border: 1px solid rgba(222, 255, 154, 0.3); color: #FFF; padding: 12px; font-family: sans-serif; font-size: 0.9rem; width: 100%; outline: none; margin-bottom: 15px; }
        .admin-input:focus { border-color: #DEFF9A; }
      `}</style>

      {/* MOBILE SHIELD */}
      <div className="orientation-shield">
        <div style={{ fontSize: '1.5rem', letterSpacing: '6px', color: '#DEFF9A', marginBottom: '20px', fontWeight: 'bold' }}>SOL UNDETERMINED</div>
        <p style={{ color: '#FFF', fontSize: '1rem', fontFamily: 'sans-serif', opacity: 0.8 }}>Please rotate your device horizontally.</p>
      </div>

      <div className="main-archive-interface" style={{ display: 'flex', width: '100%', minHeight: '100vh', position: 'relative' }}>
        
        {/* LEFT SIDE: CANVAS */}
        <section 
          onClick={handleCanvasClick}
          style={{ flex: 1, position: 'relative', borderRight: '1px solid rgba(222, 255, 154, 0.1)', zIndex: 10, cursor: adminStep === 'place' ? 'crosshair' : 'default' }}
        >
          
          {!adminMode && (
            <div 
              onClick={(e) => { e.stopPropagation(); setShowLoginPrompt(true); }}
              style={{ position: 'absolute', bottom: '20px', right: '20px', width: '12px', height: '12px', backgroundColor: '#000', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'default', zIndex: 100 }}
            >
              <span style={{ color: '#222', fontSize: '7px', fontFamily: 'sans-serif', fontWeight: 'bold' }}>S</span>
            </div>
          )}

          {showLoginPrompt && !adminMode && (
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
              <div style={{ backgroundColor: '#05050A', border: '1px solid #1A1F2E', padding: '30px', width: '300px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ color: 'rgba(222, 255, 154, 0.4)', fontSize: '0.7rem', letterSpacing: '4px', textAlign: 'center' }}>ADMIN OVERRIDE</div>
                <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()} placeholder="Enter Passcode" style={{ backgroundColor: '#0A0E17', border: '1px solid #1A1F2E', color: '#FFF', padding: '10px', fontSize: '0.9rem', outline: 'none', textAlign: 'center', letterSpacing: '2px' }} />
                {loginError && <div style={{ color: '#FF5555', fontSize: '0.75rem', textAlign: 'center', letterSpacing: '1px' }}>ACCESS DENIED</div>}
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button onClick={() => { setShowLoginPrompt(false); setPasswordInput(''); setLoginError(false); }} style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid #1A1F2E', color: '#777', cursor: 'pointer', fontSize: '0.7rem', letterSpacing: '1px' }}>CANCEL</button>
                  <button onClick={handleAdminLogin} style={{ flex: 1, padding: '10px', backgroundColor: '#DEFF9A', border: 'none', color: '#05050A', cursor: 'pointer', fontSize: '0.7rem', letterSpacing: '2px', fontWeight: 'bold' }}>ENTER</button>
                </div>
              </div>
            </div>
          )}

          {adminMode && adminStep === 'place' && (
            <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(222, 255, 154, 0.1)', border: '1px dashed #DEFF9A', color: '#DEFF9A', padding: '10px 20px', borderRadius: '4px', fontFamily: 'sans-serif', fontSize: '0.8rem', letterSpacing: '2px', zIndex: 100, backdropFilter: 'blur(5px)' }}>
              STEP 2: CLICK EMPTY SPACE TO PLACE "{newEntry.topic.toUpperCase()}" STAR
            </div>
          )}
          
          {placementError && (
            <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255, 50, 50, 0.15)', border: '1px solid #FF5555', color: '#FF5555', padding: '15px 25px', borderRadius: '4px', fontFamily: 'sans-serif', fontSize: '0.85rem', letterSpacing: '1px', zIndex: 100, backdropFilter: 'blur(5px)' }}>
              {placementError}
            </div>
          )}

          {adminMode && newEntry.x && (adminStep === 'content' || adminStep === 'success') && (
            <div style={{ position: 'absolute', top: `${newEntry.y}%`, left: `${newEntry.x}%`, width: '12px', height: '12px', backgroundColor: '#FFF', border: '2px solid #DEFF9A', borderRadius: '50%', transform: 'translate(-50%, -50%)', zIndex: 20, boxShadow: '0 0 20px #DEFF9A' }}></div>
          )}

          {adminMode && adminStep === 'content' && (
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
              <div style={{ backgroundColor: '#05050A', border: '1px solid #DEFF9A', padding: '40px', width: '450px', boxShadow: '0 20px 50px rgba(0,0,0,0.9)' }}>
                <div style={{ color: '#DEFF9A', fontSize: '0.8rem', letterSpacing: '3px', marginBottom: '25px' }}>STEP 3: ENTER ARCHIVE DATA</div>
                <form onSubmit={handleCreateStar}>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '5px', fontFamily: 'sans-serif' }}>TITLE</label>
                  <input required type="text" className="admin-input" placeholder="e.g. The Orion Protocol" value={newEntry.title} onChange={(e) => setNewEntry({...newEntry, title: e.target.value})} />
                  
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '5px', fontFamily: 'sans-serif' }}>AUTHOR</label>
                      <input required type="text" className="admin-input" placeholder="e.g. Penelope" value={newEntry.author} onChange={(e) => setNewEntry({...newEntry, author: e.target.value})} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '5px', fontFamily: 'sans-serif' }}>DATE / ERA</label>
                      <input required type="text" className="admin-input" placeholder="e.g. PHASE 10" value={newEntry.date} onChange={(e) => setNewEntry({...newEntry, date: e.target.value})} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button type="button" onClick={() => setAdminStep('place')} style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid rgba(222, 255, 154, 0.3)', color: '#FFF', cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '1px' }}>CANCEL</button>
                    <button type="submit" style={{ flex: 2, padding: '12px', background: '#DEFF9A', border: 'none', color: '#000', cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '2px', fontWeight: 'bold' }}>UPLOAD TO CLOUD</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {adminMode && adminStep === 'success' && (
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
              <div style={{ backgroundColor: '#05050A', border: '1px solid #DEFF9A', padding: '40px', width: '550px', textAlign: 'center' }}>
                <div style={{ color: '#DEFF9A', fontSize: '1.2rem', letterSpacing: '3px', marginBottom: '15px' }}>CLOUD SYNC COMPLETE</div>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontFamily: 'sans-serif', marginBottom: '25px' }}>
                  {generatedCode}
                </p>
                <button onClick={() => setAdminStep('idle')} style={{ padding: '12px 30px', background: '#DEFF9A', border: 'none', color: '#000', cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '2px', fontWeight: 'bold' }}>CONTINUE MAPPING</button>
              </div>
            </div>
          )}

          {activeTopic && adminStep === 'idle' && (
            <button onClick={(e) => { e.stopPropagation(); setActiveTopic(null); }} style={{ position: 'absolute', top: '30px', left: '30px', backgroundColor: 'rgba(5, 5, 10, 0.8)', border: '1px solid #DEFF9A', color: '#DEFF9A', padding: '8px 18px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.8rem', letterSpacing: '2px', zIndex: 100 }}>
              ← BACK TO GALAXY
            </button>
          )}

          {!activeTopic && (
            <div style={{ position: 'absolute', width: '100%', textAlign: 'center', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 1 }}>
              <div style={{ color: 'rgba(222, 255, 154, 0.12)', fontSize: '6rem', letterSpacing: '40px', fontWeight: 'bold' }}>SOL</div>
              <div style={{ color: 'rgba(222, 255, 154, 0.12)', fontSize: '3rem', letterSpacing: '18px', marginTop: '40px' }}>UNDETERMINED</div>
            </div>
          )}

          {activeTopic && (
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}>
              {activePosts.map((post, index) => {
                if (index === activePosts.length - 1) return null;
                const nextPost = activePosts[index + 1];
                return (
                  <line key={post.id} x1={post.topicX} y1={post.topicY} x2={nextPost.topicX} y2={nextPost.topicY} stroke="#DEFF9A" strokeWidth="0.75" strokeDasharray="6 6" style={{ animation: 'fadeInLine 1.5s ease-out forwards' }} />
                );
              })}
            </svg>
          )}

          {posts.map((post) => {
            const isFaded = activeTopic && post.topic !== activeTopic;
            const currentX = activeTopic ? post.topicX : post.galaxyX;
            const currentY = activeTopic ? post.topicY : post.galaxyY;

            return (
              <div 
                key={post.id}
                onMouseEnter={() => setHoveredPost(post)}
                onMouseLeave={() => setHoveredPost(null)}
                onClick={(e) => { e.stopPropagation(); setSelectedPost(post); }}
                style={{ 
                  position: 'absolute', 
                  top: currentY, 
                  left: currentX, 
                  width: '8px', 
                  height: '8px', 
                  backgroundColor: '#DEFF9A', 
                  borderRadius: '50%', 
                  cursor: 'pointer', 
                  transition: 'top 0.9s cubic-bezier(0.16, 1, 0.3, 1), left 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s, opacity 0.5s', 
                  transform: hoveredPost?.id === post.id ? 'scale(2)' : 'scale(1)', 
                  opacity: isFaded ? 0 : 1, 
                  pointerEvents: isFaded ? 'none' : 'auto', 
                  zIndex: 5, 
                  animation: isFaded ? 'none' : `twinkle 4s ease-in-out ${typeof post.id === 'number' ? post.id * 0.3 : 1}s infinite alternate`
                }}
              ></div>
            )
          })}

          {hoveredPost && !selectedPost && adminStep !== 'place' && adminStep !== 'content' && (
            <div style={{ position: 'absolute', top: `calc(${activeTopic ? hoveredPost.topicY : hoveredPost.galaxyY} - 70px)`, left: `calc(${activeTopic ? hoveredPost.topicX : hoveredPost.galaxyX} + 25px)`, backgroundColor: 'rgba(5, 5, 10, 0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(222, 255, 154, 0.25)', padding: '12px 16px', borderRadius: '2px', width: '240px', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', pointerEvents: 'none', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', letterSpacing: '2px', color: 'rgba(222, 255, 154, 0.6)' }}>
                <span>{hoveredPost.topic.toUpperCase()}</span><span>{hoveredPost.date}</span>
              </div>
              <span style={{ color: '#FFF', fontSize: '1.1rem', fontFamily: 'serif', lineHeight: '1.2' }}>{hoveredPost.title}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontStyle: 'italic', fontFamily: 'sans-serif', marginTop: '2px' }}>— {hoveredPost.author}</span>
            </div>
          )}
        </section>

        {/* RIGHT SIDE: Nav & Admin Dashboard */}
        <nav style={{ width: '280px', padding: '60px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px', zIndex: 1, position: 'relative' }}>
          
          {adminStep === 'idle' ? (
            <>
              <h2 style={{ fontSize: '0.75rem', letterSpacing: '4px', color: 'rgba(222, 255, 154, 0.4)', marginBottom: '10px' }}>EXPLORE ARCHIVE</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', maxHeight: '70vh', paddingRight: '10px' }}>
                {TOPICS_LIST.map((topic) => {
                  const isActive = activeTopic === topic;
                  return (
                    <button 
                      key={topic}
                      onClick={() => setActiveTopic(isActive ? null : topic)}
                      style={{ background: 'none', border: 'none', color: isActive ? '#FFFFFF' : '#DEFF9A', textAlign: 'left', fontSize: '1.3rem', fontFamily: 'serif', cursor: 'pointer', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', opacity: isActive ? 1 : 0.45, transform: isActive ? 'translateX(8px)' : 'translateX(0px)', fontWeight: isActive ? 'bold' : 'normal' }}
                    >
                      {topic}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ color: '#DEFF9A', borderBottom: '1px solid rgba(222, 255, 154, 0.3)', paddingBottom: '15px', marginBottom: '10px', fontSize: '0.8rem', letterSpacing: '2px', fontWeight: 'bold' }}>ADMIN WORKFLOW</div>
              
              <div style={{ opacity: adminStep === 'topic' ? 1 : 0.3, transition: '0.3s' }}>
                <div style={{ fontSize: '0.7rem', color: '#FFF', letterSpacing: '1px', marginBottom: '10px' }}>STEP 1: SELECT TOPIC</div>
                {adminStep === 'topic' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '40vh', overflowY: 'auto' }}>
                    {TOPICS_LIST.map(t => (
                      <button 
                        key={t} 
                        onClick={() => { 
                          setNewEntry({...newEntry, topic: t}); 
                          setActiveTopic(t); 
                          setAdminStep('place'); 
                        }} 
                        style={{ background: 'transparent', border: '1px solid rgba(222, 255, 154, 0.3)', color: '#DEFF9A', padding: '8px', textAlign: 'left', fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ opacity: adminStep === 'place' ? 1 : 0.3, transition: '0.3s', fontSize: '0.7rem', color: '#FFF', letterSpacing: '1px' }}>
                STEP 2: PLACE STAR
              </div>
              <div style={{ opacity: adminStep === 'content' ? 1 : 0.3, transition: '0.3s', fontSize: '0.7rem', color: '#FFF', letterSpacing: '1px' }}>
                STEP 3: ENTER DATA
              </div>
              
              <button 
                onClick={() => { 
                  setAdminStep('idle'); 
                  setActiveTopic(null); 
                  setNewEntry({ topic: '', x: '', y: '', title: '', author: '', date: '' });
                  setPlacementError('');
                }} 
                style={{ marginTop: '30px', padding: '10px', background: 'transparent', border: '1px solid #FF5555', color: '#FF5555', fontSize: '0.7rem', letterSpacing: '1px', cursor: 'pointer' }}
              >
                CANCEL CREATION
              </button>
            </div>
          )}

          {adminMode && adminStep === 'idle' && (
            <div style={{ position: 'absolute', bottom: '40px', right: '40px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => setAdminStep('topic')} style={{ background: '#DEFF9A', border: 'none', color: '#05050A', padding: '10px 15px', fontSize: '0.75rem', letterSpacing: '1px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                + ADD NEW RECORD
              </button>
              <button onClick={() => { setAdminMode(false); setActiveTopic(null); }} style={{ background: 'transparent', border: '1px solid rgba(222, 255, 154, 0.4)', color: 'rgba(222, 255, 154, 0.6)', padding: '8px 12px', fontSize: '0.7rem', letterSpacing: '1px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'sans-serif' }}>
                LOG OUT
              </button>
            </div>
          )}
        </nav>

        {/* READING MODAL */}
        {selectedPost && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3, 3, 6, 0.9)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
             <div style={{ backgroundColor: '#0A0E17', border: '1px solid rgba(222, 255, 154, 0.15)', width: '900px', height: '70vh', display: 'flex', overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,0.8)', position: 'relative' }}>
              <button onClick={() => setSelectedPost(null)} style={{ position: 'absolute', top: '25px', right: '30px', background: 'none', border: 'none', color: 'rgba(222, 255, 154, 0.6)', fontSize: '1rem', letterSpacing: '2px', cursor: 'pointer', fontFamily: 'sans-serif', zIndex: 110 }}>CLOSE ESC //</button>
              <div style={{ flex: 1, backgroundColor: '#0F1420', borderRight: '1px solid rgba(222, 255, 154, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '80%', height: '80%', border: '1px dashed rgba(222, 255, 154, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '0.75rem', letterSpacing: '3px', color: 'rgba(222, 255, 154, 0.3)' }}>[ ARCHIVAL MEDIA FRAME ]</span></div>
              </div>
              <div style={{ flex: 1, padding: '60px 50px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ display: 'flex', gap: '15px', fontSize: '0.75rem', letterSpacing: '3px', color: '#DEFF9A', marginBottom: '20px' }}><span>{selectedPost.topic.toUpperCase()}</span><span style={{ color: 'rgba(222, 255, 154, 0.3)' }}>|</span><span>{selectedPost.date}</span></div>
                <h1 style={{ color: '#FFF', fontSize: '2.4rem', fontFamily: 'serif', lineHeight: '1.1', marginBottom: '15px', fontWeight: 'normal' }}>{selectedPost.title}</h1>
                <div style={{ fontFamily: 'sans-serif', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '40px' }}>BY AUTHOR: <span style={{ color: '#FFF', fontStyle: 'italic' }}>{selectedPost.author}</span></div>
                <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '1rem', fontFamily: 'sans-serif', lineHeight: '1.7', margin: 0 }}>This is where your primary caption copy and full investigative entry text will unfold...</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}