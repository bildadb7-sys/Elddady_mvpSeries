
import React, { useState, useEffect } from 'react';
import LandingPage from './LandingPage';
import Sidebar from './Sidebar';
import RightSidebar from './RightSidebar';
import Feed from './Feed';
import Explore from './Explore';
import Vrooms from './Vrooms';
import Messages from './Messages';
import Profile from './Profile';
import UserProfile from './UserProfile'; // New Import
import ResetPasswordModal from './ResetPasswordModal';
import CartOverlay from './CartOverlay';
import ProductDetailModal from './ProductDetailModal';
import ShareModal from './ShareModal';
import Header from './Header';
import ScrollToTopButton from './ScrollToTopButton';
import AdminDashboard from './AdminDashboard';
import PrivacyPolicyPage from './PrivacyPolicyPage';
import TermsAndConditionsPage from './TermsAndConditionsPage';
import { CheckoutModal, PostModal, ForwardMessageModal } from './Modals';
import { Page, Product, CartItem, Post, Vroom as VroomType, User, Conversation } from '../types';
import { api } from '../api';
import { EMPTY_USER, APP_URL } from '../constants';
import { supabase } from '../supabaseClient';
import { CurrencyProvider } from '../context/CurrencyContext';
import { NotificationProvider } from '../context/NotificationContext';
import { Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';

// Pages that can be safely restored after a browser reload (excludes ephemeral pages like PUBLIC_PROFILE)
const PERSISTABLE_PAGES: Page[] = [Page.FEED, Page.EXPLORE, Page.VROOMS, Page.MESSAGES, Page.PROFILE];

// Wrapper component to extract userId from URL params for the public profile route
const UserProfileRoute: React.FC<{
  currentUserId: string;
  onNavigate: (page: any) => void;
  onVroomClick: (vroom: any) => void;
  onChat: (targetUser: User) => void;
  onUserClick: (userId: string) => void;
  viewingUserProfileId: string | null;
  setViewingUserProfileId: (id: string | null) => void;
}> = ({ currentUserId, onNavigate, onVroomClick, onChat, onUserClick, viewingUserProfileId, setViewingUserProfileId }) => {
  const { userId } = useParams<{ userId: string }>();
  const resolvedId = userId || viewingUserProfileId;

  // Sync the state if navigating via URL directly
  React.useEffect(() => {
    if (userId && userId !== viewingUserProfileId) {
      setViewingUserProfileId(userId);
    }
  }, [userId]);

  if (!resolvedId) return <Navigate to="/" />;

  return (
    <UserProfile
      userId={resolvedId}
      currentUserId={currentUserId}
      onNavigate={onNavigate}
      onVroomClick={onVroomClick}
      onChat={onChat}
      onUserClick={onUserClick}
    />
  );
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null | 'google_unregistered'>(null);
  const [currentUser, setCurrentUser] = useState<User>(EMPTY_USER);

  const getCurrentPage = (): Page => {
    if (location.pathname.startsWith('/explore')) return Page.EXPLORE;
    if (location.pathname.startsWith('/vrooms')) return Page.VROOMS;
    if (location.pathname.startsWith('/messages')) return Page.MESSAGES;
    if (location.pathname.startsWith('/profile') || location.pathname.startsWith('/user/')) return Page.PROFILE;
    return Page.FEED;
  };
  const currentPage = getCurrentPage();

  const setCurrentPage = (page: Page) => {
    switch (page) {
      case Page.FEED: navigate('/'); break;
      case Page.EXPLORE: navigate('/explore'); break;
      case Page.VROOMS: navigate('/vrooms'); break;
      case Page.MESSAGES: navigate('/messages'); break;
      case Page.PROFILE: navigate('/profile'); break;
      default: navigate('/'); break;
    }
  };

  const getInitialCart = (): CartItem[] => {
    try {
      const saved = localStorage.getItem('elddady_cart');
      if (saved) return JSON.parse(saved);
    } catch { }
    return [];
  };
  const [cart, setCart] = useState<CartItem[]>(getInitialCart);

  useEffect(() => {
    localStorage.setItem('elddady_cart', JSON.stringify(cart));
  }, [cart]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareProduct, setShareProduct] = useState<Product | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const [exploreQuery, setExploreQuery] = useState('');
  const [selectedVroomToOpen, setSelectedVroomToOpen] = useState<VroomType | null>(null);
  const [viewingUserProfileId, setViewingUserProfileId] = useState<string | null>(null); // New State
  const [isError, setIsError] = useState(false);

  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState<any>(null);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);

  const handleForwardMessage = async (conversationId: string, msg: any) => {
    await api.sendMessage(conversationId, msg.image ? '' : msg.content, undefined, msg.image || undefined);
    const updatedConvs = await api.getConversations();
    setConversations(updatedConvs);
  };

  // Persist active tab so reloads keep the user on their current page
  useEffect(() => {
    if (PERSISTABLE_PAGES.includes(currentPage)) {
      localStorage.setItem('elddady_active_page', currentPage);
    }
  }, [currentPage]);

  // Check for Admin hash
  const [isAdminView, setIsAdminView] = useState(window.location.hash === '#bahati' || window.location.hash === '#/bahati');

  const processDeepLink = async (path: string) => {
    try {
      if (path.startsWith('/product/')) {
        const id = path.split('/')[2];
        if (id) {
          const product = await api.getProductById(id);
          if (product) setActiveProduct(product);
        }
      } else if (path.startsWith('/vroom/')) {
        const id = path.split('/')[2];
        if (id) {
          const vroom = await api.getVroomById(id);
          if (vroom) handleVroomNavigation(vroom);
        }
      } else if (path.startsWith('/user/')) {
        const id = path.split('/')[2];
        if (id) handleViewUser(id);
      }
    } catch (e) {
      console.error("Deep link load failed", e);
    }
  };

  const loadData = async () => {
    setIsError(false);
    try {
      // Robust parallel fetching
      const feedPromise = api.getFeed().catch(e => { console.warn("Feed load failed", e); return []; });
      const convPromise = api.getConversations().catch(e => { console.warn("Chat load failed", e); return []; });

      const [feed, convs] = await Promise.all([feedPromise, convPromise]);

      setPosts(feed);
      setConversations(convs);
    } catch (e) {
      console.error("Critical: Data load error.", e);
      setIsError(true);
    }
  };

  const handleAuthSession = async (session: any) => {
    if (!session?.user) {
      setIsAuthenticated(false);
      return;
    }
    try {
      const userProfile = await api.getMe();
      setCurrentUser(userProfile);
      setIsAuthenticated(true);
      await loadData();
      api.updatePresence(); // Initial Heartbeat
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      const isNoProfile = msg.includes('no rows') || msg.includes('not found') || msg.includes('0 rows');
      if (isNoProfile) {
        console.warn('[Auth] Google user has no profile — signing out and showing blocked screen.');
        await supabase.auth.signOut();
        setIsAuthenticated('google_unregistered');
      } else {
        console.error("Profile fetch completely failed", e);
        setIsAuthenticated(false);
      }
    }
  };

  // Heartbeat Effect: Updates last_seen_at every minute
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      api.updatePresence();
    }, 60000); // 1 minute
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleAuthSession(session);
      } else {
        setIsAuthenticated(false);
      }
    });

    // 2. Real-time Auth Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowResetPasswordModal(true);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        handleAuthSession(session);
      } else if (event === 'USER_UPDATED') {
        if (session) handleAuthSession(session);
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setCurrentUser(EMPTY_USER);
        setPosts([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (email: string, password: string) => {
    // Let error bubble up to LandingPage for UI handling
    await api.login(email, password);
  };

  const handleSignUpSuccess = (user: User) => {
    // Just triggered by landing page, actual auth state handled by listener
  };

  const handleLogout = async () => {
    await api.logout();
  };

  const handleVroomNavigation = (vroom: VroomType) => {
    setSelectedVroomToOpen(vroom);
    setCurrentPage(Page.VROOMS);
    setIsRightSidebarOpen(false);
  };

  // Logic to view another user's profile
  const handleViewUser = (userId: string) => {
    if (userId === currentUser.id) {
      setCurrentPage(Page.PROFILE);
    } else {
      setViewingUserProfileId(userId);
      navigate(`/user/${userId}`);
    }
    setIsRightSidebarOpen(false); // Close sidebar if open
  };

  // Chat initiation logic
  const handleStartChat = async (targetUser: User) => {
    try {
      const conversation = await api.startDirectMessage(targetUser.id);
      // Refresh convs to ensure latest state
      const updatedConvs = await api.getConversations();
      setConversations(updatedConvs);
      setCurrentPage(Page.MESSAGES);
      // Ideally, we'd also set the active chat ID in Messages component, 
      // but Messages component handles selection internally via prop or state.
      // For now, simpler redirect. A robust app would pass `initialActiveChatId` prop.
    } catch (e) {
      alert("Failed to start chat.");
      console.error(e);
    }
  };

  const handleAddToCart = (p: Product) => {
    // 1. Check if user is trying to buy their own product (No Self-Buying)
    if (p.userId === currentUser.id) {
      alert("You cannot add your own product to the cart.");
      return;
    }

    // 2. Check if product is out of stock (Stock Management)
    if (p.isOutOfStock) {
      alert("This product is currently out of stock.");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      if (existing) {
        return prev.map(item => item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...p, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (id: string, newQty: number) => {
    if (newQty < 1) {
      setCart(prev => prev.filter(i => i.id !== id));
      return;
    }
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: newQty } : i));
  };

  if (isAuthenticated === null) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#E86C44]"></div>
        <p className="text-muted-foreground font-medium animate-pulse text-sm">Connecting to Elddady...</p>
      </div>
    );
  }

  if (!isAuthenticated || isAuthenticated === 'google_unregistered') {
    if (location.pathname === '/privacy') {
      return <PrivacyPolicyPage />;
    }
    if (location.pathname === '/terms') {
      return <TermsAndConditionsPage />;
    }
    return <LandingPage
      onLogin={handleLogin}
      onSignUp={handleSignUpSuccess}
      isGoogleBlocked={isAuthenticated === 'google_unregistered'}
    />;
  }

  // Don't need isAdminView check here anymore. We will use a top level Route for /bahati.

  const unreadConvsCount = conversations.filter(c => (c.unreadCount || 0) > 0).length;

  const renderContent = () => {
    if (isError && posts.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
          <i className="fas fa-wifi text-4xl text-muted-foreground mb-4"></i>
          <h3 className="text-lg font-bold mb-2">Connection Issue</h3>
          <p className="text-muted-foreground mb-6 text-sm">We couldn't load your feed. Please check your internet connection.</p>
          <button
            onClick={loadData}
            className="px-6 py-2 bg-primary text-white rounded-lg font-bold shadow-md active:scale-95"
          >
            Retry
          </button>
        </div>
      );
    }
    return null;
  };

  const defaultProps = {
    onAddToCart: handleAddToCart,
    onProductClick: setActiveProduct,
    onShare: (p: Product) => { setShareProduct(p); setIsShareModalOpen(true); },
    onVroomClick: handleVroomNavigation,
    currentUser: currentUser,
    onUserClick: handleViewUser
  };

  const errorContent = renderContent();

  const appLayout = (child: React.ReactNode) => (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <CartOverlay
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onRemoveItem={(id) => setCart(cart.filter(i => i.id !== id))}
        onUpdateQuantity={handleUpdateQuantity}
        onCheckout={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
      />
      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} onConfirm={() => setCart([])} cartItems={cart} />
      <ResetPasswordModal isOpen={showResetPasswordModal} onClose={() => setShowResetPasswordModal(false)} />
      <PostModal isOpen={isPostModalOpen} onClose={() => setIsPostModalOpen(false)} onSubmit={async (data) => { await api.postProduct(data); loadData(); }} />
      {activeProduct && <ProductDetailModal isOpen={true} onClose={() => setActiveProduct(null)} product={activeProduct} currentUser={currentUser} onAddToCart={(p) => { handleAddToCart(p); setIsCartOpen(true); }} onShare={(p) => { setShareProduct(p); setIsShareModalOpen(true); }} onUserClick={handleViewUser} />}
      {shareProduct && <ShareModal isOpen={isShareModalOpen} onClose={() => { setIsShareModalOpen(false); setShareProduct(null); }} productName={shareProduct.name} productUrl={`${APP_URL}/product/${shareProduct.id}`} title="Share Product" productId={shareProduct.id} productImage={shareProduct.image} productDescription={shareProduct.description} productPrice={shareProduct.price} productCurrency={shareProduct.currency} />}

      <ForwardMessageModal isOpen={isForwardModalOpen} onClose={() => { setIsForwardModalOpen(false); setMessageToForward(null); }} message={messageToForward} conversations={conversations} onForward={handleForwardMessage} />

      <Header
        currentUser={currentUser}
        cartItemCount={cart.length}
        onNavigate={setCurrentPage}
        onToggleCart={() => setIsCartOpen(true)}
      />

      <div className="flex justify-center min-h-screen w-full">
        <aside className="hidden md:flex flex-col h-screen sticky top-0 w-[72px] lg:w-[240px] xl:w-[275px] z-30 flex-shrink-0 border-r border-border">
          <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} cartItemCount={cart.length} unreadMessagesCount={unreadConvsCount} onToggleCart={() => setIsCartOpen(true)} onOpenPostModal={() => setIsPostModalOpen(true)} onLogout={handleLogout} />
        </aside>

        <div className="flex-1 flex flex-col min-w-0 max-w-[550px] border-r border-border h-screen relative pt-16 md:pt-0">
          <main className="flex-1 overflow-y-auto no-scrollbar pb-20 md:pb-0 w-full">
            {errorContent || child}
          </main>
          <div className="md:hidden">
            <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} cartItemCount={cart.length} unreadMessagesCount={unreadConvsCount} onToggleCart={() => setIsCartOpen(true)} onOpenPostModal={() => setIsPostModalOpen(true)} onLogout={handleLogout} />
          </div>
        </div>
        <div className="hidden md:block md:w-[200px] lg:w-[320px] xl:w-[350px] h-screen sticky top-0">
          {/* Right Sidebar acts as the search/discovery engine. Clicking a user result here should trigger the profile view. */}
          <RightSidebar
            isOpen={isRightSidebarOpen}
            onClose={() => setIsRightSidebarOpen(false)}
            onHashtagClick={(tag) => { setExploreQuery(tag); setCurrentPage(Page.EXPLORE); }}
            onVroomClick={handleVroomNavigation}
            currentUser={currentUser}
            onUserClick={handleViewUser}
          />
        </div>
      </div>

      <ScrollToTopButton />
    </div>
  );

  return (
    <CurrencyProvider>
      <NotificationProvider currentUser={currentUser} onNavigate={setCurrentPage}>
        <Routes>
          <Route path="/bahati/*" element={currentUser.isAdmin ? <AdminDashboard /> : <Navigate to="/" />} />
          <Route path="/" element={appLayout(<Feed posts={posts} {...defaultProps} />)} />
          <Route path="/explore" element={appLayout(<Explore {...defaultProps} initialSearchQuery={exploreQuery} />)} />
          <Route path="/vrooms" element={appLayout(<Vrooms initialVroomData={selectedVroomToOpen || undefined} {...defaultProps} />)} />
          <Route path="/messages" element={appLayout(
            <Messages
              conversations={conversations}
              onSendMessage={api.sendMessage}
              currentUser={currentUser}
              onUserClick={handleViewUser}
              onMarkAsRead={(id: string) => setConversations(prev => prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c))}
              onForward={(msg) => { setMessageToForward(msg); setIsForwardModalOpen(true); }}
              onInternalLink={processDeepLink}
              onProductClick={setActiveProduct}
              onAddToCart={(p) => { handleAddToCart(p); setIsCartOpen(true); }}
            />
          )} />
          <Route path="/profile" element={appLayout(
            <Profile user={currentUser} isOwner={true} onPostProduct={() => setIsPostModalOpen(true)} onUserUpdate={setCurrentUser} {...defaultProps} />
          )} />
          <Route path="/user/:userId" element={appLayout(
            <UserProfileRoute
              currentUserId={currentUser.id}
              onNavigate={setCurrentPage}
              onVroomClick={handleVroomNavigation}
              onChat={handleStartChat}
              onUserClick={handleViewUser}
              viewingUserProfileId={viewingUserProfileId}
              setViewingUserProfileId={setViewingUserProfileId}
            />
          )} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsAndConditionsPage />} />
          <Route path="*" element={appLayout(<Feed posts={posts} {...defaultProps} />)} />
        </Routes>
      </NotificationProvider>
    </CurrencyProvider>
  );
};

export default App;

