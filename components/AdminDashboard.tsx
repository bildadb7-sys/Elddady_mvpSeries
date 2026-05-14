
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '..//api';
import { PostReport, DetailedDispute } from '../types';

const AdminDashboard: React.FC = () => {
   const navigate = useNavigate();
   const [data, setData] = useState<{ reports: PostReport[], disputes: DetailedDispute[], zahidiBalance?: number, ppcCost?: number, adsEnabled?: boolean, boostedProducts?: any[] }>({ reports: [], disputes: [] });
   const [loading, setLoading] = useState(true);
   const [activeTab, setActiveTab] = useState<'reports' | 'disputes' | 'zahidi' | 'comms'>('reports');
   const [adminBalance, setAdminBalance] = useState(0);
   const [newCPC, setNewCPC] = useState<number | ''>('');
   const [adsEnabled, setAdsEnabled] = useState(true);
   const [updatingAds, setUpdatingAds] = useState(false);
   const [commsTarget, setCommsTarget] = useState<string>('');
   const [commsMessage, setCommsMessage] = useState<string>('');
   const [commsSending, setCommsSending] = useState(false);

   const handleRefundBuyer = async (orderId: string) => {
      try {
         await api.refundBuyer(orderId);
         alert('Buyer has been refunded successfully.');
         window.location.reload();
      } catch (e: any) { alert(e.message); }
   };

   const handleReleaseToSeller = async (orderId: string) => {
      try {
         await api.releaseToSeller(orderId);
         alert('Funds released to seller successfully.');
         window.location.reload();
      } catch (e: any) { alert(e.message); }
   };

   const handleNeedMoreInfo = async (orderId: string) => {
      try {
         await api.needMoreInfo(orderId);
         alert('Requested more information from the buyer.');
         window.location.reload();
      } catch (e: any) { alert(e.message); }
   };

   const handleSendAdminMessage = async () => {
      if (!commsTarget || !commsMessage) return alert("Please specify both a Target User ID and Message.");
      try {
         setCommsSending(true);
         await api.sendAdminSystemMessage(commsTarget, commsMessage);
         alert('Message sent successfully from Elddady Admin.');
         setCommsMessage('');
         setCommsTarget('');
      } catch (e: any) {
         alert('Failed to send message: ' + e.message);
      } finally {
         setCommsSending(false);
      }
   };

   const handleDeletePost = async (postId: string) => {
      if (!window.confirm("Are you sure you want to delete this post? It will be archived in deleted_posts.")) return;
      try {
         await api.deletePost(postId);
         alert("Post deleted and archived successfully.");
         window.location.reload();
      } catch (e: any) { alert("Delete failed: " + e.message); }
   };

   const handleFreezeUser = async (userId: string) => {
      if (!window.confirm("Are you sure you want to FREEZE this user's account? They will be unable to log in.")) return;
      try {
         await api.freezeUser(userId);
         alert("User account successfully frozen.");
         window.location.reload();
      } catch (e: any) { alert("Freeze failed: " + e.message); }
   };


   useEffect(() => {
      const fetchAdminData = async () => {
         try {
            const [res, me] = await Promise.all([api.getAdminData(), api.getMe()]);
            setData(res);
            setAdminBalance(me.walletBalance || 0);
            setNewCPC(res.ppcCost || 15);
            setAdsEnabled(res.adsEnabled ?? true);
         } catch (e) {
            console.error(e);
         } finally {
            setLoading(false);
         }
      };
      fetchAdminData();
   }, []);

   if (loading) return <div className="p-20 text-center animate-pulse">Loading Admin Control Panel...</div>;

   return (
      <div className="flex-1 min-h-screen bg-zinc-50 pb-20">
         <div className="bg-zinc-900 text-white p-6 shadow-lg">
            <div className="max-w-6xl mx-auto flex justify-between items-center">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#E86C44] rounded-lg flex items-center justify-center font-black text-xl">E</div>
                  <div>
                     <h1 className="text-xl font-black tracking-tight">ELDDADY ADMIN</h1>
                     <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Platform Safety & Disputes</p>
                  </div>
               </div>
               <div className="flex items-center gap-6">
                  <button onClick={() => navigate('/')} className="text-xs font-bold hover:underline opacity-80">EXIT ADMIN SIDE</button>
               </div>
            </div>
         </div>

         <div className="max-w-6xl mx-auto p-6">
            <div className="flex gap-4 mb-8">
               <button
                  onClick={() => setActiveTab('reports')}
                  className={`flex-1 py-4 px-6 rounded-2xl font-black text-sm tracking-widest transition-all shadow-sm flex items-center justify-center gap-3 ${activeTab === 'reports' ? 'bg-[#E86C44] text-white' : 'bg-white text-zinc-500 hover:bg-zinc-100'}`}
               >
                  <i className="fas fa-flag"></i>
                  REPORTS ({data.reports.length})
               </button>
               <button
                  onClick={() => setActiveTab('disputes')}
                  className={`flex-1 py-4 px-6 rounded-2xl font-black text-sm tracking-widest transition-all shadow-sm flex items-center justify-center gap-3 ${activeTab === 'disputes' ? 'bg-[#E86C44] text-white' : 'bg-white text-zinc-500 hover:bg-zinc-100'}`}
               >
                  <i className="fas fa-gavel"></i>
                  DISPUTES ({data.disputes.filter(d => d.status === 'Pending' || d.status === 'Need More Info').length} active)
               </button>
               <button
                  onClick={() => setActiveTab('zahidi')}
                  className={`flex-1 py-4 px-6 rounded-2xl font-black text-sm tracking-widest transition-all shadow-sm flex items-center justify-center gap-3 ${activeTab === 'zahidi' ? 'bg-[#E86C44] text-white' : 'bg-white text-zinc-500 hover:bg-zinc-100'}`}
               >
                  <i className="fas fa-wallet"></i>
                  ZAHIDI ACCOUNT
               </button>
               <button
                  onClick={() => setActiveTab('comms')}
                  className={`flex-1 py-4 px-6 rounded-2xl font-black text-sm tracking-widest transition-all shadow-sm flex items-center justify-center gap-3 ${activeTab === 'comms' ? 'bg-[#E86C44] text-white' : 'bg-white text-zinc-500 hover:bg-zinc-100'}`}
               >
                  <i className="fas fa-bullhorn"></i>
                  SYSTEM COMMS
               </button>
            </div>

            {activeTab === 'reports' && (
               <div className="space-y-4">
                  {data.reports.length === 0 ? <p className="text-center py-20 text-zinc-400 font-bold">ALL CLEAR! NO REPORTS PENDING.</p> :
                     data.reports.map(rep => (
                        <div key={rep.id} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm hover:border-[#E86C44]/30 transition-all">
                           <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                 <div className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">Post Flagged</div>
                                 <span className="text-xs text-zinc-400 font-medium">{new Date(rep.timestamp).toLocaleString()}</span>
                              </div>
                              <div className="flex gap-3">
                                 {rep.postAuthorId && (
                                    <button onClick={() => handleFreezeUser(rep.postAuthorId!)} className="px-3 py-1 bg-red-600 text-white rounded font-black text-[10px] tracking-widest hover:bg-red-700 shadow-sm transition-colors">FREEZE ACCOUNT</button>
                                 )}
                                 <button onClick={() => handleDeletePost(rep.postId)} className="px-3 py-1 bg-zinc-800 text-white rounded font-black text-[10px] tracking-widest hover:bg-zinc-900 shadow-sm transition-colors">DELETE POST</button>
                              </div>
                           </div>
                           <div className="grid md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-zinc-400 uppercase">Reason for Flag</label>
                                 <p className="text-zinc-900 font-bold bg-zinc-50 p-4 rounded-xl border border-zinc-100">{rep.reason}</p>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-zinc-400 uppercase">Original Content</label>
                                 <div className="text-zinc-500 text-sm leading-relaxed italic border-l-4 border-zinc-200 pl-4 py-1">
                                    "{rep.postContent || 'Content no longer available'}"
                                 </div>
                              </div>
                           </div>
                           <div className="mt-4 flex gap-2">
                              <span className="text-[10px] font-bold text-zinc-400">Reporter ID: {rep.reporterId}</span>
                              <span className="text-[10px] font-bold text-zinc-400">·</span>
                              <span className="text-[10px] font-bold text-zinc-400">Post ID: {rep.postId}</span>
                           </div>
                        </div>
                     ))}
               </div>
            )}

            {activeTab === 'disputes' && (() => {
               const newDisps      = data.disputes.filter(d => d.status === 'Pending');
               const pendingDisps  = data.disputes.filter(d => d.status === 'Need More Info');
               const resolvedDisps = data.disputes.filter(d => d.status === 'Refunded' || d.status === 'Released');

               const DisputeCard = ({ disp, showActions }: { disp: any; showActions: boolean }) => (
                  <div key={disp.id} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                     <div className="bg-zinc-50 border-b border-zinc-100 p-4 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                           <div className="bg-zinc-800 text-white px-3 py-1 rounded text-[10px] font-black uppercase">DISPUTE #{disp.id.slice(-4)}</div>
                           <span className="text-xs font-bold text-zinc-400">ORDER: {disp.orderId}</span>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                           disp.status === 'Pending'        ? 'bg-orange-100 text-orange-600'
                           : disp.status === 'Need More Info' ? 'bg-yellow-100 text-yellow-700'
                           : disp.status === 'Refunded'     ? 'bg-green-100 text-green-600'
                           : disp.status === 'Released'     ? 'bg-blue-100 text-blue-600'
                           : 'bg-zinc-100 text-zinc-500'
                        }`}>
                           {disp.status}
                        </div>
                     </div>
                     <div className="p-6 space-y-6">
                        <div className="grid md:grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                            <div>
                                <h4 className="text-[10px] font-black text-zinc-400 uppercase mb-2">Buyer Information</h4>
                                <p className="text-sm font-bold text-zinc-800">{disp.buyer?.name} <span className="text-xs text-zinc-500 hover:underline cursor-pointer" onClick={() => navigate(`/user/${disp.buyer?.id}`)}>@{disp.buyer?.handle}</span></p>
                                <p className="text-xs text-zinc-500 mt-1"><i className="fas fa-envelope mx-1"></i> {disp.buyer?.email || 'N/A'}</p>
                                <p className="text-xs text-zinc-500"><i className="fas fa-phone mx-1"></i> {disp.buyer?.mobile || 'N/A'}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-zinc-400 uppercase mb-2">Seller Information</h4>
                                <p className="text-sm font-bold text-zinc-800">{disp.seller?.name} <span className="text-xs text-zinc-500 hover:underline cursor-pointer" onClick={() => navigate(`/user/${disp.seller?.id}`)}>@{disp.seller?.handle}</span></p>
                                <p className="text-xs text-zinc-500 mt-1"><i className="fas fa-envelope mx-1"></i> {disp.seller?.email || 'N/A'}</p>
                                <p className="text-xs text-zinc-500"><i className="fas fa-phone mx-1"></i> {disp.seller?.mobile || 'N/A'}</p>
                            </div>
                            <div className="col-span-full border-t border-zinc-200 mt-2 pt-4">
                                <h4 className="text-[10px] font-black text-zinc-400 uppercase mb-2">Product Details</h4>
                                <p className="text-sm font-bold text-zinc-800">{disp.productDetails || 'Unknown'}</p>
                                <p className="text-xs text-zinc-500 mt-1">Purchased on: {disp.purchaseDate ? new Date(disp.purchaseDate).toLocaleString() : 'N/A'}</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-zinc-400 uppercase">Buyer Claims & Evidence</label>
                           <p className="text-zinc-900 font-medium leading-relaxed bg-zinc-50 p-4 rounded-xl border border-zinc-100">{disp.claims}</p>
                        </div>
                        {disp.evidencePhotos.length > 0 && (
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-zinc-400 uppercase">Attached Photos ({disp.evidencePhotos.length})</label>
                              <div className="flex flex-wrap gap-3">
                                 {disp.evidencePhotos.map((p: string, i: number) => (
                                    <img key={i} src={p} className="w-24 h-24 rounded-lg object-cover border border-zinc-200 hover:scale-110 transition-transform cursor-zoom-in" />
                                 ))}
                              </div>
                           </div>
                        )}
                        {showActions && (
                           <div className="flex gap-3 pt-4">
                              <button onClick={() => handleRefundBuyer(disp.orderId)} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-black text-xs tracking-widest hover:bg-green-700 shadow-md">REFUND BUYER</button>
                              <button onClick={() => handleReleaseToSeller(disp.orderId)} className="flex-1 py-3 bg-zinc-800 text-white rounded-xl font-black text-xs tracking-widest hover:bg-zinc-900 shadow-md">RELEASE TO SELLER</button>
                              <button onClick={() => handleNeedMoreInfo(disp.orderId)} className="flex-1 py-3 border border-zinc-200 rounded-xl font-black text-xs tracking-widest hover:bg-zinc-50">NEED MORE EVIDENCE</button>
                           </div>
                        )}
                        {!showActions && (
                           <div className="flex items-center gap-2 pt-2 text-xs text-zinc-400 font-bold">
                              <i className="fas fa-check-circle text-green-500"></i> This dispute has been resolved. No further action needed.
                           </div>
                        )}
                     </div>
                  </div>
               );

               return (
                  <div className="space-y-10">
                     {/* Category 1 – New Disputes */}
                     <div>
                        <div className="flex items-center gap-3 mb-4">
                           <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse"></div>
                           <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800">New Disputes <span className="text-orange-500">({newDisps.length})</span></h2>
                           <span className="text-[10px] text-zinc-400 font-medium">– Awaiting first admin action</span>
                        </div>
                        {newDisps.length === 0
                           ? <p className="text-center py-8 text-zinc-400 font-bold bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">No new disputes. 🎉</p>
                           : <div className="space-y-4">{newDisps.map(d => <DisputeCard key={d.id} disp={d} showActions={true} />)}</div>
                        }
                     </div>

                     {/* Category 2 – Pending Disputes */}
                     <div>
                        <div className="flex items-center gap-3 mb-4">
                           <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                           <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800">Pending Disputes <span className="text-yellow-600">({pendingDisps.length})</span></h2>
                           <span className="text-[10px] text-zinc-400 font-medium">– Awaiting more evidence from buyer</span>
                        </div>
                        {pendingDisps.length === 0
                           ? <p className="text-center py-8 text-zinc-400 font-bold bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">No disputes pending evidence.</p>
                           : <div className="space-y-4">{pendingDisps.map(d => <DisputeCard key={d.id} disp={d} showActions={true} />)}</div>
                        }
                     </div>

                     {/* Category 3 – Resolved Disputes */}
                     <div>
                        <div className="flex items-center gap-3 mb-4">
                           <div className="w-3 h-3 rounded-full bg-green-500"></div>
                           <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800">Resolved Disputes <span className="text-green-600">({resolvedDisps.length})</span></h2>
                           <span className="text-[10px] text-zinc-400 font-medium">– Refunded or Released</span>
                        </div>
                        {resolvedDisps.length === 0
                           ? <p className="text-center py-8 text-zinc-400 font-bold bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">No resolved disputes yet.</p>
                           : <div className="space-y-4">{resolvedDisps.map(d => <DisputeCard key={d.id} disp={d} showActions={false} />)}</div>
                        }
                     </div>
                  </div>
               );
            })()}


            {activeTab === 'zahidi' && (
               <div className="space-y-6">
                  {/* Master Switch for Boost Product functionality */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                     <div>
                        <div className="flex items-center gap-2">
                           <span className={`w-2.5 h-2.5 rounded-full ${adsEnabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                           <h3 className="font-black text-sm uppercase tracking-widest text-zinc-900">"Boost Product" Visibility Control</h3>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1 max-w-xl">
                           {adsEnabled 
                              ? "Status: Active. The Boost button is currently visible on users' products, allowing them to start promotions." 
                              : "Status: Closed. The Boost button is completely hidden from user view across the entire platform."}
                        </p>
                     </div>
                     <button
                        onClick={async () => {
                           try {
                              setUpdatingAds(true);
                              const nextState = !adsEnabled;
                              await api.updateAdsEnabled(nextState);
                              setAdsEnabled(nextState);
                              setData(prev => ({ ...prev, adsEnabled: nextState }));
                              alert(`"Boost product" functionality has been ${nextState ? 'opened (returned to user view)' : 'closed (hidden from user view)'} successfully.`);
                           } catch (e: any) {
                              alert("Failed to update status: " + e.message);
                           } finally {
                              setUpdatingAds(false);
                           }
                        }}
                        disabled={updatingAds}
                        className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm shrink-0 ${
                           adsEnabled 
                              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' 
                              : 'bg-green-600 text-white hover:bg-green-700 shadow-green-600/20'
                        }`}
                     >
                        {updatingAds ? (
                           <i className="fas fa-circle-notch fa-spin"></i>
                        ) : adsEnabled ? (
                           <><i className="fas fa-eye-slash"></i> Close Boost Feature</>
                        ) : (
                           <><i className="fas fa-eye"></i> Open Boost Feature</>
                        )}
                     </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                     <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                        <div>
                           <label className="text-[10px] font-black text-zinc-400 uppercase">ZaHidi Account Balance</label>
                           <p className="text-3xl font-black text-[#E86C44] mt-2">KES {data.zahidiBalance?.toLocaleString() || 0}</p>
                        </div>
                     </div>
                     <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                        <label className="text-[10px] font-black text-zinc-400 uppercase mb-4 block">Global Cost Per Click (CPC)</label>
                        <div className="flex gap-4 items-center">
                           <div className="flex items-center">
                              <span className="bg-zinc-100 border border-r-0 border-zinc-300 rounded-l-lg px-3 py-2 text-zinc-500 font-bold">KES</span>
                              <input type="number" value={newCPC} onChange={(e) => setNewCPC(Number(e.target.value) || '')} className="border border-zinc-300 rounded-r-lg px-4 py-2 text-lg font-bold w-24 outline-none focus:border-[#E86C44]" />
                           </div>
                           <button onClick={async () => { if(typeof newCPC === 'number') { await api.updatePPCCost(newCPC); alert('CPC Updated to KES ' + newCPC); } }} className="px-6 py-2 bg-zinc-900 text-white rounded-lg font-bold hover:bg-zinc-800 transition-colors shadow-sm">Update CPC</button>
                        </div>
                     </div>
                  </div>
                  
                  <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                     <div className="bg-zinc-50 border-b border-zinc-100 p-4">
                        <h2 className="text-sm font-black tracking-widest uppercase">Boosted Products ({data.boostedProducts?.length || 0})</h2>
                     </div>
                     <div className="divide-y divide-zinc-100">
                        {data.boostedProducts?.length === 0 ? <p className="text-center py-10 text-zinc-400 font-bold">No Boosted Products Found.</p> :
                        data.boostedProducts?.map(bp => (
                           <div key={bp.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-zinc-50 transition-colors">
                              <div className="flex flex-col gap-1">
                                 <span className="text-xs font-black uppercase text-zinc-900">Product: {bp.productId}</span>
                                 <span className="text-xs text-zinc-500 font-medium">Seller: {bp.sellerName} <span className="uppercase text-[10px] bg-zinc-200 px-2 py-0.5 rounded-full ml-1">{bp.sellerCountry}</span></span>
                              </div>
                              <div className="flex gap-6 sm:text-right">
                                 <div className="flex flex-col justify-end">
                                    <span className="text-[10px] uppercase font-bold text-zinc-400">Total Clicks</span>
                                    <span className="font-black text-zinc-800">{bp.clicks}</span>
                                 </div>
                                 <div className="flex flex-col justify-end">
                                    <span className="text-[10px] uppercase font-bold text-zinc-400">Deducted</span>
                                    <span className="font-black text-[#E86C44]">KES {bp.deducted}</span>
                                 </div>
                                 <div className="flex flex-col justify-end">
                                    <span className="text-[10px] uppercase font-bold text-zinc-400">Status</span>
                                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded inline-block ${bp.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{bp.status}</span>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'comms' && (
               <div className="space-y-6">
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                     <h2 className="text-sm font-black tracking-widest uppercase mb-6">Send Admin System Message</h2>
                     <div className="space-y-4">
                        <div>
                           <label className="text-[10px] font-black text-zinc-400 uppercase mb-2 block">Target User ID</label>
                           <input type="text" value={commsTarget} onChange={(e) => setCommsTarget(e.target.value)} placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000" className="w-full border border-zinc-300 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-[#E86C44]" />
                        </div>
                        <div>
                           <label className="text-[10px] font-black text-zinc-400 uppercase mb-2 block">Message Content</label>
                           <textarea value={commsMessage} onChange={(e) => setCommsMessage(e.target.value)} placeholder="Type your message here..." className="w-full border border-zinc-300 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-[#E86C44] min-h-[120px] resize-none" />
                        </div>
                        <p className="text-xs text-zinc-500 font-medium pb-2"><i className="fas fa-info-circle mr-1"></i> Messages sent from here will appear as direct messages from the <strong>@elddadinc</strong> Superadmin account.</p>
                        <button onClick={handleSendAdminMessage} disabled={commsSending} className="w-full py-4 bg-[#E86C44] hover:bg-[#d05c38] text-white rounded-xl font-black text-sm tracking-widest disabled:opacity-50 transition-all flex justify-center items-center gap-2">
                           {commsSending ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                           {commsSending ? 'SENDING...' : 'SEND MESSAGE'}
                        </button>
                     </div>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
};

export default AdminDashboard;
