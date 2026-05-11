
import React from 'react';
import { User, Page } from '../types';
import { Link } from 'react-router-dom';

interface HeaderProps {
  currentUser: User;
  cartItemCount: number;
  onNavigate: (page: Page) => void;
  onToggleCart: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, cartItemCount, onNavigate, onToggleCart }) => {
  const handleLogoClick = () => {
    // 1. Navigate to Feed first if not already there
    onNavigate(Page.FEED);

    // 2. Trigger global window scroll for mobile view
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 3. Robust backup: find the scrollable main content area and reset it
    const scrollContainer = document.querySelector('main');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white z-50 shadow-sm flex items-center px-4 gap-3 border-b border-border">
      {/* Item 1: Brand Name (Far Left) - Click to scroll to top */}
      <Link
        to="/"
        className="cursor-pointer flex-shrink-0 active:scale-95 transition-transform block"
        onClick={handleLogoClick}
        title="Home"
      >
        <img src="/logo.png" alt="Elddady" className="h-8 w-auto object-contain drop-shadow-sm" />
      </Link>

      {/* Item 2: Search Bar (Middle - flex-1 forces it to expand) */}
      <Link
        to="/explore"
        data-title="Search"
        className="custom-tooltip flex-1 bg-gray-100 rounded-full h-10 flex items-center px-4 gap-2 cursor-pointer no-underline"
        onClick={() => onNavigate(Page.EXPLORE)}
      >
        <i className="fas fa-search text-muted-foreground text-sm"></i>
        <span className="text-muted-foreground text-sm truncate">Search...</span>
      </Link>

      {/* Item 3: Cart Icon (Right) */}
      <button
        data-title="Cart"
        onClick={onToggleCart}
        className="custom-tooltip relative w-10 h-10 flex items-center justify-center text-foreground active:scale-90 transition-transform flex-shrink-0"
      >
        <i className="fas fa-shopping-cart text-xl text-[#E86C44]"></i>
        {cartItemCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#E86C44] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
            {cartItemCount}
          </span>
        )}
      </button>

      {/* Item 4: Profile Button (Far Right) */}
      <Link
        to="/profile"
        data-title={currentUser.name}
        onClick={() => onNavigate(Page.PROFILE)}
        className="custom-tooltip w-10 h-10 rounded-full overflow-hidden border-2 border-[#E86C44] active:scale-90 transition-transform flex-shrink-0 block"
      >
        <img
          src={currentUser.avatar}
          alt="Profile"
          className="w-full h-full object-cover"
        />
      </Link>
    </header>
  );
};

export default Header;
