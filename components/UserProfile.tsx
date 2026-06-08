
import React, { useEffect, useState } from 'react';
import { User, Vroom } from '../types';
import { api } from '../api';
import { supabase } from '../supabaseClient';

interface UserProfileProps {
  userId: string;
  currentUserId: string;
  onNavigate: (page: any) => void;
  onVroomClick: (vroom: Vroom) => void;
  onChat: (targetUser: User) => void;
  onUserClick?: (userId: string) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ userId, currentUserId, onNavigate, onVroomClick, onChat, onUserClick }) => {
  const [profile, setProfile] = useState<User | null>(null);
  const [vrooms, setVrooms] = useState<Vroom[]>([]);
  const [followingVrooms, setFollowingVrooms] = useState<Vroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowedBy, setIsFollowedBy] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [liveFollowersCount, setLiveFollowersCount] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    setIsDarkMode(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [userData, userVrooms, isFollowingStatus, isFollowedByStatus, userFollowingVrooms, userStats] = await Promise.all([
          api.getPublicProfile(userId),
          api.getPublicUserVrooms(userId),
          api.getIsFollowingUser(userId),
          api.getIsFollowedByUser(userId),
          api.getPublicUserFollowingVrooms(userId),
          api.getUserStats(userId)
        ]);
        setProfile(userData);
        setVrooms(userVrooms);
        setIsFollowing(isFollowingStatus);
        setIsFollowedBy(isFollowedByStatus);
        setFollowingVrooms(userFollowingVrooms);
        // getUserStats counts directly from user_follows — always accurate
        setLiveFollowersCount(userStats.followers);
      } catch (err) {
        console.error("Failed to load public profile", err);
        setError("User not found or connection failed.");
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchData();
  }, [userId]);

  // Handle global follow events for Vrooms
  useEffect(() => {
    const handleVroomFollowChange = (e: CustomEvent) => {
      const { vroomId, isFollowing, followers } = e.detail;
      setVrooms(prev => prev.map(v =>
        v.id === vroomId ? { ...v, isFollowing, followers } : v
      ));
      setFollowingVrooms(prev => prev.map(v =>
        v.id === vroomId ? { ...v, isFollowing, followers } : v
      ));
    };

    const handleViewed = (e: CustomEvent) => {
      const { vroomId, newCount } = e.detail;
      setVrooms(prev => prev.map(v =>
        v.id === vroomId ? { ...v, views: newCount != null ? newCount.toString() : (parseInt(v.views || '0') + 1).toString() } : v
      ));
      setFollowingVrooms(prev => prev.map(v =>
        v.id === vroomId ? { ...v, views: newCount != null ? newCount.toString() : (parseInt(v.views || '0') + 1).toString() } : v
      ));
    };

    window.addEventListener('vroom-follow-changed' as any, handleVroomFollowChange);
    window.addEventListener('vroom-viewed' as any, handleViewed);

    // Listen for user follow events to update follower count in real-time
    const handleUserFollowChanged = (e: CustomEvent) => {
      const { userId: changedUserId, followers } = e.detail;
      if (changedUserId === userId) {
        setLiveFollowersCount(followers);
      }
    };
    window.addEventListener('user-follow-changed' as any, handleUserFollowChanged);

    // Real-time subscription on user_follows for live follower count
    const profileChannel = supabase.channel(`user-profile-followers-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_follows', filter: `following_id=eq.${userId}` },
        async () => {
          const stats = await api.getUserStats(userId);
          setLiveFollowersCount(stats.followers);
        }
      )
      .subscribe();

    // Real-time updates for vrooms (followers and views)
    const channel = supabase.channel(`user-profile-vrooms-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vrooms', filter: `owner_id=eq.${userId}` },
        (payload) => {
          const updatedVroom = payload.new as any;

          setVrooms(prev => prev.map(v => {
            if (v.id === updatedVroom.id) {
              return {
                ...v,
                followers: updatedVroom.followers_count,
                views: updatedVroom.views_count?.toString() || v.views
              };
            }
            return v;
          }));
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('vroom-follow-changed' as any, handleVroomFollowChange);
      window.removeEventListener('vroom-viewed' as any, handleViewed);
      window.removeEventListener('user-follow-changed' as any, handleUserFollowChanged);
      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);
    };
  }, [userId]);

  const handleFollowToggle = async () => {
    setFollowLoading(true);
    try {
      const { isFollowing: newStatus, followers } = await api.toggleFollowUser(userId);
      setIsFollowing(newStatus);
      setLiveFollowersCount(followers);
      if (profile) {
        setProfile({
          ...profile,
          followersCount: followers
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleVroomFollowToggle = async (e: React.MouseEvent, vroomId: string) => {
    e.stopPropagation();
    try {
      await api.toggleFollowVroom(vroomId);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-background flex items-center justify-center">
        <div className="text-[#E86C44] animate-pulse flex flex-col items-center">
          <i className="fas fa-circle-notch fa-spin text-3xl mb-2"></i>
          <span className="text-sm font-bold uppercase tracking-widest">Loading Profile...</span>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex-1 min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
          <i className="fas fa-user-slash text-3xl text-muted-foreground opacity-50"></i>
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">Profile Not Found</h2>
        <button onClick={() => onNavigate('FEED')} className="text-[#E86C44] font-bold text-sm hover:underline">
          Return to Feed
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-background pb-20">

      {/* Header Section */}
      <div className="bg-card border-b border-border shadow-sm">
        {/* Banner */}
        <div className="h-48 md:h-64 relative bg-gradient-to-r from-orange-100 to-amber-50 group">
          {profile.bannerImage ? (
            <img
              src={profile.bannerImage}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-10 text-[#E86C44]">
              <i className="fas fa-image text-6xl"></i>
            </div>
          )}
        </div>

        <div className="px-4 md:px-8 pb-6 relative">
          <div className="flex flex-col md:flex-row justify-between items-start -mt-16 md:-mt-20">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-card bg-card overflow-hidden shadow-xl">
                <img
                  src={profile.avatar || 'https://via.placeholder.com/150'}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {profile.isOnline && (
                <div className="absolute bottom-4 right-4 w-5 h-5 bg-green-500 border-4 border-card rounded-full" title="Online"></div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 md:mt-24 flex gap-3 w-full md:w-auto">
              {userId !== currentUserId && (
                <>
                  <button
                    onClick={() => onChat(profile)}
                    className="flex-1 md:flex-none px-6 py-2.5 bg-[#E86C44] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#d6623e] transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-comment-alt"></i> Message
                  </button>
                  <button
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-2 ${isFollowing ? 'bg-card border-border text-foreground' : 'bg-transparent border-[#E86C44] text-[#E86C44] hover:bg-orange-50'}`}
                  >
                    {followLoading ? (
                      <i className="fas fa-circle-notch fa-spin"></i>
                    ) : isFollowing ? 'Following' : isFollowedBy ? 'Follow Back' : 'Follow'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* User Details */}
          <div className="mt-4 space-y-2">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground uppercase tracking-tight">
                {profile.name}
              </h1>
              <p className="text-[#E86C44] text-sm md:text-base font-bold tracking-wide">
                {profile.handle}
              </p>
            </div>

            {profile.bio && (
              <p className="text-muted-foreground text-sm md:text-base font-medium leading-relaxed max-w-2xl">
                {profile.bio}
              </p>
            )}

            <div className="flex flex-wrap gap-4 pt-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
              {profile.location && (
                <span className="flex items-center gap-1">
                  <i className="fas fa-map-marker-alt"></i> {profile.location}
                </span>
              )}
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                  <i className="fas fa-link"></i> Website
                </a>
              )}
              <span className="flex items-center gap-1">
                <i className="fas fa-store"></i> {vrooms.length} Vrooms
              </span>
              {profile.followersCount !== undefined && (
                <span className="flex items-center gap-1 text-[#E86C44]">
                  <i className="fas fa-users"></i> {liveFollowersCount} Followers
                </span>
              )}
              <button
                onClick={toggleDarkMode}
                className="ml-auto w-6 h-6 flex items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80 transition-all shadow-sm"
                title="Toggle Dark Mode"
              >
                <i className={`fas ${isDarkMode ? 'fa-sun text-yellow-500' : 'fa-moon text-blue-500'}`}></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section: Vrooms */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-12">
        <div>
          <h3 className="text-lg font-black text-foreground mb-6 flex items-center gap-2">
            <i className="fas fa-store text-[#E86C44]"></i> Public Vrooms
          </h3>

          {vrooms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {vrooms.map((vroom) => (
                <div
                  key={vroom.id}
                  onClick={() => onVroomClick(vroom)}
                  className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl transition-all cursor-pointer group h-full flex flex-col relative"
                >
                  <div className="h-48 bg-muted relative overflow-hidden">
                    <img
                      src={vroom.coverImage}
                      alt={vroom.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>

                    {/* View Count Overlay */}
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-white text-[10px] font-bold uppercase flex items-center gap-1">
                      <i className="fas fa-eye"></i> {vroom.views}
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    <h4 className="font-black text-base text-foreground uppercase tracking-tight line-clamp-1 mb-1 group-hover:text-[#E86C44] transition-colors">
                      {vroom.name}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                      {vroom.description}
                    </p>

                    <div className="mt-auto flex items-center justify-between text-[10px] font-bold text-muted-foreground border-t border-border pt-3 uppercase tracking-widest">
                      <span>{vroom.productCount} Items</span>
                      <span>{vroom.followers} Followers</span>
                    </div>

                    {userId !== currentUserId && (
                      <button
                        onClick={(e) => handleVroomFollowToggle(e, vroom.id)}
                        className={`mt-3 w-full py-1.5 rounded text-[10px] font-bold uppercase transition-colors ${vroom.isFollowing ? 'bg-muted text-foreground' : 'bg-[#E86C44] text-white hover:bg-[#d6623e]'}`}
                      >
                        {vroom.isFollowing ? 'Following' : 'Follow Vroom'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl bg-muted/20">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-box-open text-2xl text-muted-foreground opacity-50"></i>
              </div>
              <p className="text-muted-foreground font-bold text-sm">No public Vrooms yet.</p>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-black text-foreground mb-6 flex items-center gap-2">
            <i className="fas fa-heart text-[#E86C44]"></i> Vrooms Following
          </h3>

          {followingVrooms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {followingVrooms.map((vroom) => (
                <div
                  key={vroom.id}
                  onClick={() => onVroomClick(vroom)}
                  className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl transition-all cursor-pointer group h-full flex flex-col relative"
                >
                  <div className="h-48 bg-muted relative overflow-hidden">
                    <img
                      src={vroom.coverImage}
                      alt={vroom.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>

                    {/* View Count Overlay */}
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-white text-[10px] font-bold uppercase flex items-center gap-1">
                      <i className="fas fa-eye"></i> {vroom.views}
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    <h4 className="font-black text-base text-foreground uppercase tracking-tight line-clamp-1 mb-1 group-hover:text-[#E86C44] transition-colors">
                      {vroom.name}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                      {vroom.description}
                    </p>

                    <div className="mt-auto flex items-center justify-between text-[10px] font-bold text-muted-foreground border-t border-border pt-3 uppercase tracking-widest">
                      <span>{vroom.productCount} Items</span>
                      <span>{vroom.followers} Followers</span>
                    </div>

                    {userId !== currentUserId && (
                      <button
                        onClick={(e) => handleVroomFollowToggle(e, vroom.id)}
                        className={`mt-3 w-full py-1.5 rounded text-[10px] font-bold uppercase transition-colors ${vroom.isFollowing ? 'bg-muted text-foreground' : 'bg-[#E86C44] text-white hover:bg-[#d6623e]'}`}
                      >
                        {vroom.isFollowing ? 'Following' : 'Follow Vroom'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl bg-muted/20">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-heart-broken text-2xl text-muted-foreground opacity-50"></i>
              </div>
              <p className="text-muted-foreground font-bold text-sm">Not following any Vrooms yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
