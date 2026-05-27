
export enum Page {
  LANDING = 'LANDING',
  FEED = 'FEED',
  EXPLORE = 'EXPLORE',
  TRENDING = 'TRENDING',
  VROOMS = 'VROOMS',
  MESSAGES = 'MESSAGES',
  PROFILE = 'PROFILE',
  PUBLIC_PROFILE = 'PUBLIC_PROFILE',
  ADMIN = 'ADMIN'
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface User {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  email?: string;
  bannerImage?: string;
  lastUsernameChange?: number;
  blockedUsers?: string[];
  currency?: string;
  walletBalance?: number; // Cashy Wallet Balance
  isOnline?: boolean; // Online Status
  isAdmin?: boolean; // Admin privilege
  // Extended Profile Details
  bio?: string;
  location?: string;
  website?: string;
  instagram?: string;
  mobile?: string; // Market Standard: Contact info
  gender?: string;
  dob?: string;
  country?: string;
  lastSeenAt?: string; // Added for Last Active functionality
  followersCount?: number;
  followingCount?: number;
}

export interface Comment {
  id: string;
  user: User;
  content: string;
  timestamp: string;
  replies: Comment[];
  reactions?: Reaction[];
  image?: string; // Added field for comment attachments
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  image: string;
  video?: string; // New field for video posts
  likes: number;
  stock?: number;
  isOutOfStock?: boolean; // New Field: Out of Stock Status
  commentsCount?: number;
  sharesCount?: number;
  comments?: Comment[];
  userId?: string;
  isLiked?: boolean;
  isBookmarked?: boolean;
  category?: string;
  tags?: { tag: string; weight: number }[]; // Added tags support
  isSponsored?: boolean; // Added for PPC
}

export interface Post {
  id: string;
  user: User;
  product: Product;
  timestamp: string;
  commentsCount: number;
  sharesCount: number;
  content: string;
}

export interface Vroom {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  productCount: number;
  followers: number;
  views: string;
  recent_views?: number; // Added to fix RightSidebar errors
  products: Product[];
  ownerName?: string;
  ownerId?: string;
  isPublic?: boolean;
  isFollowing?: boolean; // NEW: Track follow status
  isSponsored?: boolean; // Added for PPC
}

export interface AppSettings {
  id: number;
  ads_enabled: boolean;
  ppc_cost: number;
  admin_user_id?: string;
}

export interface Promotion {
  id: string;
  user_id: string;
  item_type: 'product' | 'vroom';
  item_id: string;
  total_clicks: number;
  status: 'active' | 'paused' | 'exhausted';
  created_at: string;
}

export interface MessageReply {
  id: string;
  content: string;
  senderName: string;
  image?: string;
}

export interface SharedProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  image: string;
  productUrl: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  image?: string; // New field for image attachments
  timestamp: string;
  createdAt?: string; // New field for exact date calculation
  isMe: boolean;
  replyTo?: MessageReply;
  isSystem?: boolean; // New field for system messages
  reactions?: Reaction[];
  isEdited?: boolean;
  isDeleted?: boolean;
  starredBy?: string[];
  status?: 'sent' | 'delivered' | 'read';
  sharedProduct?: SharedProduct; // Embedded product card data
}

export interface Conversation {
  id: string;
  user?: User;
  lastMessage: string;
  lastMessageTime: string;
  messages: Message[];
  aboutProduct?: string;
  unreadCount?: number;
  lastMessageTimestamp?: number;

  isGroup?: boolean;
  groupName?: string;
  groupDescription?: string;
  groupPhoto?: string;
  ownerId?: string;
  participants?: User[];
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  shipping: {
    recipientName: string;
    country: string;
    state: string;
    city: string;
    street: string;
  };
  total: number;
  currency: string;
  timestamp: string;
  status: 'Processing' | 'Shipped' | 'Delivered' | 'Completed' | 'Disputed' | 'Refunded';
  disputeResolved?: boolean;
  disputeStatus?: 'Pending' | 'Reviewing' | 'Resolved' | 'Refunded' | 'Released' | 'Need More Info' | null;
}

export interface SearchResults {
  users: User[];
  products: Product[];
  vrooms: Vroom[];
  hashtags: string[];
}

export interface PostReport {
  id: string;
  postId: string;
  reporterId: string;
  reason: string;
  timestamp: string;
  postContent?: string;
  postAuthorId?: string;
}

export interface DetailedDispute {
  id: string;
  orderId: string;
  userId: string;
  claims: string;
  evidencePhotos: string[];
  timestamp: string;
  status: 'Pending' | 'Reviewing' | 'Resolved' | 'Refunded' | 'Released' | 'Need More Info';
  buyer?: { name: string; handle: string; email?: string; mobile?: string };
  seller?: { name: string; handle: string; email?: string; mobile?: string };
  purchaseDate?: string;
  productDetails?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'message' | 'order' | 'system';
  link?: string;
  timestamp: number;
}
