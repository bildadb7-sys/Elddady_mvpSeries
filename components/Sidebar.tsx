
import React from 'react';
import { Page } from '../types';
import { Link } from 'react-router-dom';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  cartItemCount: number;
  unreadMessagesCount?: number;
  onToggleCart: () => void;
  onOpenPostModal: () => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  cartItemCount,
  unreadMessagesCount,
  onToggleCart,
  onOpenPostModal,
  onLogout
}) => {

  const navItems = [
    { page: Page.FEED, icon: "fa-home", label: "Home", to: "/" },
    { page: Page.EXPLORE, icon: "fa-compass", label: "Explore", to: "/explore" },
    { page: Page.VROOMS, icon: "fa-store", label: "Vrooms", to: "/vrooms" },
    { page: Page.MESSAGES, icon: "fa-comments", label: "Messages", badge: unreadMessagesCount, to: "/messages" },
    { page: Page.PROFILE, icon: "fa-user", label: "Profile", to: "/profile" },
  ];

  // --- Desktop & Tablet Sidebar (Vertical) ---
  const DesktopSidebar = () => (
    <div className="h-full flex flex-col p-2 lg:p-4 bg-card transition-all duration-300 w-full overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center justify-center lg:justify-start mb-4 lg:mb-8 h-14 lg:px-2 flex-shrink-0 cursor-pointer" onClick={() => onNavigate(Page.FEED)}>
        <img src="/ELD_orng_nobg.png" alt="Elddady" className="h-10 lg:h-12 w-auto object-contain transition-all duration-300 drop-shadow-sm" />
      </div>

      {/* Navigation & Actions Container */}
      <div className="flex flex-col space-y-4 flex-1 w-full">
        {/* Main Nav Items */}
        <nav className="space-y-4 w-full">
          {navItems.map((item) => (
            <Link
              key={item.page}
              to={item.to}
              onClick={() => onNavigate(item.page)}
              className={`w-full flex items-center justify-center lg:justify-start lg:space-x-4 px-3 py-2 rounded-lg transition-colors group relative ${currentPage === item.page
                ? 'bg-[#E86C44] text-white font-medium'
                : 'hover:bg-muted text-foreground font-medium'
                }`}
              title={item.label}
            >
              <div className="relative">
                <i className={`fas ${item.icon} w-6 text-center text-lg ${currentPage === item.page ? 'text-white' : 'text-foreground'}`}></i>
                {(item.badge && item.badge > 0) ? (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-card z-10">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-base hidden lg:block">{item.label}</span>
              <span className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 lg:hidden pointer-events-none whitespace-nowrap z-50">
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        {/* Action Items (Cart, Post, Logout) */}
        <div className="space-y-4 w-full pb-8">
          <button
            onClick={onToggleCart}
            className="w-full bg-[#E86C44]/80 text-white py-2 px-0 lg:px-4 rounded-lg font-medium hover:bg-[#E86C44] transition-colors flex items-center justify-center lg:justify-start lg:space-x-4 relative group"
            title="Cart"
          >
            <i className="fas fa-shopping-cart text-lg w-6 text-center"></i>
            <span className="hidden lg:inline text-sm">Cart</span>
            {cartItemCount > 0 && (
              <span className="bg-white text-[#E86C44] px-1.5 py-0.5 rounded-full text-[10px] font-bold absolute -top-1 -right-1 lg:top-auto lg:right-4 border border-[#E86C44]">
                {cartItemCount}
              </span>
            )}
          </button>

          <button
            onClick={onOpenPostModal}
            className="w-full bg-[#E86C44] text-white py-2 px-0 lg:px-4 rounded-lg font-medium hover:bg-[#d6623e] transition-colors flex items-center justify-center lg:justify-start lg:space-x-4 shadow-sm"
            title="Post Product"
          >
            <div className="flex items-center justify-center w-6">
              <i className="fas fa-plus text-lg"></i>
            </div>
            <span className="hidden lg:inline text-sm">Post Product</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full text-muted-foreground py-2 px-0 lg:px-4 rounded-lg font-medium hover:bg-muted hover:text-foreground transition-colors flex items-center justify-center lg:justify-start lg:space-x-4"
            title="Logout"
          >
            <i className="fas fa-sign-out-alt text-lg w-6 text-center"></i>
            <span className="hidden lg:inline text-sm">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );

  // --- Mobile Bottom Navigation ---
  const MobileNav = () => (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.1)]">
      <div className="flex justify-between items-center px-2 py-1">
        {navItems.slice(0, 2).map((item) => (
          <Link
            key={item.page}
            to={item.to}
            onClick={() => onNavigate(item.page)}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${currentPage === item.page ? 'text-[#E86C44]' : 'text-muted-foreground'
              }`}
          >
            <div className="relative">
              <i className={`fas ${item.icon} text-xl mb-0.5`}></i>
              {(item.badge && item.badge > 0) ? (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center border border-card z-10">
                  {item.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
          </Link>
        ))}

        {/* Center Primary Action Button */}
        <div className="flex-1 flex justify-center -mt-8">
          <button
            onClick={onOpenPostModal}
            className="bg-[#E86C44] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-4 border-background active:scale-90 transition-transform"
          >
            <i className="fas fa-plus text-2xl"></i>
          </button>
        </div>

        {navItems.slice(2, 4).map((item) => (
          <Link
            key={item.page}
            to={item.to}
            onClick={() => onNavigate(item.page)}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${currentPage === item.page ? 'text-[#E86C44]' : 'text-muted-foreground'
              }`}
          >
            <div className="relative">
              <i className={`fas ${item.icon} text-xl mb-0.5`}></i>
              {(item.badge && item.badge > 0) ? (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center border border-card z-10">
                  {item.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
          </Link>
        ))}
        {/* Profile button removed - migrated to Top Header */}
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:block h-full w-full">
        <DesktopSidebar />
      </div>
      <div className="md:hidden">
        <MobileNav />
      </div>
    </>
  );
};

export default Sidebar;
