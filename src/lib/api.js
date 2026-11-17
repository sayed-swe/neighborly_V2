// All database access lives here so pages stay small.
import { supabase } from './supabase'
import { boundingBox } from './geo'

const AUTHOR = 'author:profiles(id, full_name, username, avatar_url, role)'

// Strip characters that have meaning inside PostgREST or() filters
const clean = (s = '') => String(s).replace(/[,()%*\\]/g, ' ').trim()

function check({ data, error, count }) {
  if (error) throw new Error(error.message)
  return count !== undefined && count !== null ? { data, count } : data
}

async function uid() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('Please sign in again')
  return id
}

/* ---------------- storage ---------------- */
export async function uploadImage(file, folder = 'misc') {
  if (!file) return null
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be smaller than 5 MB')
  const me = await uid()
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${me}/${folder}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw new Error(error.message)
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}

/* ---------------- lookups ---------------- */
export const getNeighborhoods = async () =>
  check(await supabase.from('neighborhoods').select('*').order('name'))
export const getPostCategories = async () =>
  check(await supabase.from('post_categories').select('*').order('id'))
export const getServiceCategories = async () =>
  check(await supabase.from('service_categories').select('*').order('name'))

/* ---------------- profiles ---------------- */
export const getProfile = async (id) =>
  check(await supabase.from('profiles').select('*, neighborhood:neighborhoods(*)').eq('id', id).maybeSingle())
export const getProfileByUsername = async (username) =>
  check(await supabase.from('profiles').select('*, neighborhood:neighborhoods(*)').eq('username', username).maybeSingle())
export const updateProfile = async (id, values) =>
  check(await supabase.from('profiles').update(values).eq('id', id).select().single())
export const searchPeople = async (q, limit = 8) => {
  let query = supabase.from('profiles').select('id, full_name, username, avatar_url, neighborhood:neighborhoods(name)').eq('status', 'active').limit(limit)
  if (q) query = query.or(`full_name.ilike.%${clean(q)}%,username.ilike.%${clean(q)}%`)
  return check(await query.order('created_at', { ascending: false }))
}
export const getNeighbors = async (neighborhoodId, excludeId, limit = 8) => {
  let q = supabase.from('profiles').select('id, full_name, username, avatar_url, role').eq('status', 'active').neq('id', excludeId).limit(limit)
  if (neighborhoodId) q = q.eq('neighborhood_id', neighborhoodId)
  return check(await q.order('created_at', { ascending: false }))
}

/* ---------------- feed / posts ---------------- */
export const PAGE_SIZE = 10

export async function getFeed({ page = 0, neighborhoodId, categoryId, userId, search, near, radiusKm = 3, postType } = {}) {
  let q = supabase.from('feed_posts').select('*').eq('status', 'published')
  if (neighborhoodId) q = q.eq('neighborhood_id', neighborhoodId)
  if (categoryId) q = q.eq('category_id', categoryId)
  if (userId) q = q.eq('user_id', userId)
  if (postType) q = q.eq('post_type', postType)
  if (search) q = q.or(`body.ilike.%${clean(search)}%,title.ilike.%${clean(search)}%`)
  if (near) {
    const b = boundingBox(near, radiusKm)
    q = q.gte('latitude', b.minLat).lte('latitude', b.maxLat).gte('longitude', b.minLng).lte('longitude', b.maxLng)
  }
  q = q.order('created_at', { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
  return check(await q)
}

export const getPost = async (id) =>
  check(await supabase.from('feed_posts').select('*').eq('id', id).maybeSingle())

export async function createPost(values) {
  const me = await uid()
  return check(await supabase.from('posts').insert({ ...values, user_id: me }).select('id').single())
}
export const updatePost = async (id, values) => check(await supabase.from('posts').update(values).eq('id', id))
export const deletePost = async (id) => check(await supabase.from('posts').delete().eq('id', id))

export async function sharePost(postId, body = '', neighborhoodId = null) {
  return createPost({ shared_post_id: postId, body, neighborhood_id: neighborhoodId })
}

/* ---------------- reactions ---------------- */
// target: { post_id } | { comment_id } | { event_id }
export async function setReaction(target, type) {
  const me = await uid()
  const [col, val] = Object.entries(target)[0]
  if (!type) return check(await supabase.from('reactions').delete().eq('user_id', me).eq(col, val))
  const { data: existing } = await supabase.from('reactions').select('id').eq('user_id', me).eq(col, val).maybeSingle()
  if (existing) return check(await supabase.from('reactions').update({ reaction_type: type }).eq('id', existing.id))
  return check(await supabase.from('reactions').insert({ user_id: me, [col]: val, reaction_type: type }))
}

export const getReactors = async (postId) =>
  check(await supabase.from('reactions').select(`reaction_type, user:profiles(id, full_name, username, avatar_url)`).eq('post_id', postId).order('created_at', { ascending: false }))

/* ---------------- comments ---------------- */
// target: { post_id: 1 } | { listing_id: 2 } | ...
export async function getComments(target) {
  const [col, val] = Object.entries(target)[0]
  return check(await supabase.from('comments')
    .select(`id, content, parent_id, created_at, user_id, status, ${AUTHOR}, reactions(user_id)`)
    .eq(col, val).eq('status', 'visible').order('created_at', { ascending: true }))
}
export async function addComment(target, content, parentId = null) {
  const me = await uid()
  return check(await supabase.from('comments').insert({ ...target, content, parent_id: parentId, user_id: me })
    .select(`id, content, parent_id, created_at, user_id, status, ${AUTHOR}, reactions(user_id)`).single())
}
export const deleteComment = async (id) => check(await supabase.from('comments').delete().eq('id', id))

/* ---------------- reports ---------------- */
export async function createReport(targetType, targetId, reason, details) {
  const me = await uid()
  return check(await supabase.from('reports').insert({ reporter_id: me, target_type: targetType, target_id: String(targetId), reason, details }))
}

/* ---------------- marketplace ---------------- */
export async function getListings({ type, category, search, status = 'available', userId } = {}) {
  let q = supabase.from('marketplace_listings').select(`*, ${AUTHOR}, neighborhood:neighborhoods(name)`)
  if (status) q = q.eq('status', status)
  if (type) q = q.eq('listing_type', type)
  if (category) q = q.eq('category', category)
  if (userId) q = q.eq('user_id', userId)
  if (search) q = q.or(`title.ilike.%${clean(search)}%,description.ilike.%${clean(search)}%`)
  return check(await q.order('created_at', { ascending: false }).limit(60))
}
export const getListing = async (id) =>
  check(await supabase.from('marketplace_listings').select(`*, ${AUTHOR}, neighborhood:neighborhoods(name)`).eq('id', id).maybeSingle())
export async function createListing(values) {
  const me = await uid()
  return check(await supabase.from('marketplace_listings').insert({ ...values, user_id: me }).select().single())
}
export const updateListing = async (id, values) => check(await supabase.from('marketplace_listings').update(values).eq('id', id))
export const deleteListing = async (id) => check(await supabase.from('marketplace_listings').delete().eq('id', id))

/* ---------------- lost & found ---------------- */
export async function getLostFound({ type, status = 'open', search } = {}) {
  let q = supabase.from('lost_found_items').select(`*, ${AUTHOR}, neighborhood:neighborhoods(name)`)
  if (status) q = q.eq('status', status)
  if (type) q = q.eq('report_type', type)
  if (search) q = q.or(`item_name.ilike.%${clean(search)}%,description.ilike.%${clean(search)}%,location.ilike.%${clean(search)}%`)
  return check(await q.order('created_at', { ascending: false }).limit(60))
}
export const getLostFoundItem = async (id) =>
  check(await supabase.from('lost_found_items').select(`*, ${AUTHOR}, neighborhood:neighborhoods(name)`).eq('id', id).maybeSingle())
export async function createLostFound(values) {
  const me = await uid()
  return check(await supabase.from('lost_found_items').insert({ ...values, user_id: me }).select().single())
}
export const updateLostFound = async (id, values) => check(await supabase.from('lost_found_items').update(values).eq('id', id))
export const deleteLostFound = async (id) => check(await supabase.from('lost_found_items').delete().eq('id', id))

/* ---------------- events ---------------- */
export async function getEvents({ when = 'upcoming' } = {}) {
  let q = supabase.from('events').select(`*, creator:profiles(id, full_name, username, avatar_url), event_participants(user_id, rsvp), neighborhood:neighborhoods(name)`)
  const now = new Date(Date.now() - 6 * 3600 * 1000).toISOString()
  if (when === 'upcoming') q = q.gte('starts_at', now).neq('status', 'cancelled').order('starts_at', { ascending: true })
  else q = q.lt('starts_at', now).order('starts_at', { ascending: false })
  return check(await q.limit(50))
}
export const getEvent = async (id) =>
  check(await supabase.from('events').select(`*, creator:profiles(id, full_name, username, avatar_url), event_participants(user_id, rsvp, user:profiles(id, full_name, avatar_url)), neighborhood:neighborhoods(name)`).eq('id', id).maybeSingle())
export async function createEvent(values) {
  const me = await uid()
  return check(await supabase.from('events').insert({ ...values, created_by: me }).select().single())
}
export const updateEvent = async (id, values) => check(await supabase.from('events').update(values).eq('id', id))
export const deleteEvent = async (id) => check(await supabase.from('events').delete().eq('id', id))
export async function setRsvp(eventId, rsvp) {
  const me = await uid()
  if (!rsvp) return check(await supabase.from('event_participants').delete().eq('event_id', eventId).eq('user_id', me))
  return check(await supabase.from('event_participants').upsert({ event_id: eventId, user_id: me, rsvp }, { onConflict: 'event_id,user_id' }))
}

/* ---------------- services & help ---------------- */
export async function getServices({ categoryId, search } = {}) {
  let q = supabase.from('services').select(`*, provider:profiles(id, full_name, username, avatar_url), category:service_categories(name, icon), neighborhood:neighborhoods(name)`).eq('is_active', true)
  if (categoryId) q = q.eq('service_category_id', categoryId)
  if (search) q = q.or(`service_name.ilike.%${clean(search)}%,description.ilike.%${clean(search)}%`)
  return check(await q.order('is_verified', { ascending: false }).order('created_at', { ascending: false }).limit(60))
}
export async function createService(values) {
  const me = await uid()
  return check(await supabase.from('services').insert({ ...values, provider_id: me }).select().single())
}
export const updateService = async (id, values) => check(await supabase.from('services').update(values).eq('id', id))
export const deleteService = async (id) => check(await supabase.from('services').delete().eq('id', id))

export async function getHelpRequests({ status } = {}) {
  let q = supabase.from('help_requests').select(`*, ${AUTHOR}, neighborhood:neighborhoods(name), help_responses(id, message, created_at, responder:profiles(id, full_name, username, avatar_url))`)
  if (status === 'active') q = q.in('status', ['open', 'in_progress'])
  else if (status) q = q.eq('status', status)
  return check(await q.order('created_at', { ascending: false }).limit(50))
}
export async function createHelpRequest(values) {
  const me = await uid()
  return check(await supabase.from('help_requests').insert({ ...values, user_id: me }).select().single())
}
export const updateHelpRequest = async (id, values) => check(await supabase.from('help_requests').update(values).eq('id', id))
export const deleteHelpRequest = async (id) => check(await supabase.from('help_requests').delete().eq('id', id))
export async function respondToHelp(helpRequestId, message) {
  const me = await uid()
  return check(await supabase.from('help_responses').insert({ help_request_id: helpRequestId, responder_id: me, message }))
}

/* ---------------- service requests ---------------- */
const REQUEST_SELECT = `*, service:services(id, service_name, contact_phone, contact_email),
  requester:profiles!service_requests_requester_id_fkey(id, full_name, username, avatar_url, phone),
  provider:profiles!service_requests_provider_id_fkey(id, full_name, username, avatar_url, phone)`
// side: 'requester' (requests I sent) or 'provider' (requests for my services)
export async function getServiceRequests(side = 'requester') {
  const me = await uid()
  return check(await supabase.from('service_requests').select(REQUEST_SELECT)
    .eq(side === 'provider' ? 'provider_id' : 'requester_id', me).order('created_at', { ascending: false }).limit(100))
}
export async function createServiceRequest(values) {
  const me = await uid()
  return check(await supabase.from('service_requests').insert({ ...values, requester_id: me }))
}
export const updateServiceRequest = async (id, values) => check(await supabase.from('service_requests').update(values).eq('id', id))
export async function countIncomingRequests() {
  const me = await uid()
  const { count } = await supabase.from('service_requests').select('id', { count: 'exact', head: true }).eq('provider_id', me).eq('status', 'pending')
  return count || 0
}

/* ---------------- alerts & notifications ---------------- */
export async function getAlerts({ status = 'active' } = {}) {
  let q = supabase.from('emergency_alerts').select(`*, ${AUTHOR}, neighborhood:neighborhoods(name)`)
  if (status) q = q.eq('status', status)
  return check(await q.order('created_at', { ascending: false }).limit(50))
}
export async function createAlert(values) {
  const me = await uid()
  return check(await supabase.from('emergency_alerts').insert({ ...values, created_by: me }).select().single())
}
export const updateAlert = async (id, values) => check(await supabase.from('emergency_alerts').update(values).eq('id', id))

export const getNotifications = async () =>
  check(await supabase.from('notifications').select('*, actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url)').order('created_at', { ascending: false }).limit(60))
export async function countUnreadNotifications() {
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false)
  return count || 0
}
export async function markAllNotificationsRead() {
  const me = await uid()
  return check(await supabase.from('notifications').update({ is_read: true }).eq('user_id', me).eq('is_read', false))
}
export const markNotificationRead = async (id) => check(await supabase.from('notifications').update({ is_read: true }).eq('id', id))

/* ---------------- messages ---------------- */
export const getConversations = async () => check(await supabase.rpc('my_conversations'))
export const startConversation = async (otherUserId) => check(await supabase.rpc('start_conversation', { other_user: otherUserId }))
export const getMessages = async (conversationId) =>
  check(await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(500))
export async function sendMessage(conversationId, body, imageUrl = null) {
  const me = await uid()
  return check(await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: me, body: body || '', image_url: imageUrl }).select().single())
}
export async function markConversationRead(conversationId) {
  const me = await uid()
  return check(await supabase.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('user_id', me))
}
export const getConversationMembers = async (conversationId) =>
  check(await supabase.from('conversation_members').select('user_id, user:profiles(id, full_name, username, avatar_url)').eq('conversation_id', conversationId))

/* ---------------- map ---------------- */
export const getMapItems = async () => check(await supabase.from('map_items').select('*').order('created_at', { ascending: false }).limit(500))

/* ---------------- admin ---------------- */
export const adminStats = async () => check(await supabase.rpc('admin_stats'))
export const adminUsers = async () => check(await supabase.rpc('admin_users'))
