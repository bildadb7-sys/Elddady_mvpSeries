
import { User } from './types';

// System-wide production constants
export const APP_NAME = 'Elddady';

// Default Empty User Object for initialization
export const EMPTY_USER: User = {
  id: '',
  name: 'Guest User',
  handle: '@guest',
  avatar: 'https://ui-avatars.com/api/?name=Guest&background=random',
  walletBalance: 0,
  isOnline: false
};

// --- FIX: Added exported CURRENT_USER and MOCK_USERS to resolve import errors in components ---
export const CURRENT_USER: User = {
  id: 'me',
  name: 'Ciber Crack',
  handle: '@cibercrack',
  avatar: 'https://picsum.photos/100/100',
  walletBalance: 2500,
  isOnline: true,
  bio: 'Digital creator.',
  location: 'Nairobi, Kenya'
};

export const MOCK_USERS: Record<string, User> = {
  'u1': { id: 'u1', name: 'Alex Chen', handle: '@alexdesigns', avatar: 'https://picsum.photos/101/101' },
  'u2': { id: 'u2', name: 'Sarah Martinez', handle: '@sarahcrafts', avatar: 'https://picsum.photos/102/102' },
  'u3': { id: 'u3', name: 'Mike Thompson', handle: '@mikemakes', avatar: 'https://picsum.photos/103/103' }
};
