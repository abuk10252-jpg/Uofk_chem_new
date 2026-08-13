import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl, TextInput, ScrollView,
  Modal, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/constants/colors';
import { apiCall } from '../../src/utils/api';

const EMOJIS = [
  '👍','❤️','🔥','😍','👏','💡','📚','✅','🎯','💪',
  '🙏','😂','😮','🤔','💯','⭐','🎓','🧪','⚡','🌟',
  '👀','💎','🤩','😊','👎'
];

interface NewsItem {
  id: string;
  type: string;
  title: string;
  title_ar: string;
  content: string;
  content_ar: string;
  image: string;
  created_by_name: string;
  created_at: string;
  reactions: Record<string, number>;
  user_reactions: Record<string, string>;
  comments: any[];
  poll_options?: any[];
  poll_voters?: string[];
  quiz_questions?: any[];
  quiz_time_limit?: number;
  quiz_submissions?: any[];
  quiz_results_published?: boolean;
}

export default function NewsTab() {
  const { user } = useAuth();
  const router = useRouter();
  const lang = user?.language || 'en';
  const isArabic = lang === 'ar';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [showEmojis, setShowEmojis] = useState<string>('');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number[]>>({});
  const [submitting, setSubmitting] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editItem, setEditItem] = useState<NewsItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [quizResultsModal, setQuizResultsModal] = useState<any>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  // الرسالة اللي بيتم الرد عليها حالياً، لكل بوست على حدة (زي الرد في واتساب)
  const [replyingTo, setReplyingTo] = useState<Record<string, { id: string; name: string; text: string } | null>>({});

  const fetchNews = useCallback(async () => {
    try {
      const data = await apiCall('/news/');
      if (data?.news) setNews(data.news);
    } catch (e) {
      console.warn('fetchNews error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, []);

  async function handleReact(newsId: string, emoji: string) {
    try {
      const data = await apiCall(`/news/${newsId}/react`, {
        method: 'POST',
        body: JSON.stringify({ reaction: emoji }),
      });
      if (data) {
        setNews(prev =>
          prev.map(n =>
            n.id === newsId
              ? {
                  ...n,
                  reactions: data.reactions ?? n.reactions,
                  user_reactions: data.user_reactions ?? n.user_reactions,
                }
              : n
          )
        );
      }
    } catch (e) {
      console.warn('handleReact error:', e);
    }
    setShowEmojis('');
  }

  async function handleComment(newsId: string) {
    const text = commentText[newsId]?.trim();
    if (!text) return;
    const replyTarget = replyingTo[newsId] || null;
    try {
      const data = await apiCall(`/news/${newsId}/comment`, {
        method: 'POST',
        // ملاحظة: بنبعت reply_to للباك إند عشان يتخزن ويتشارك مع باقي
        // المستخدمين. لو الباك إند لسه مش بيدعم الحقل ده هيتجاهله من غير
        // ما يعمل مشكلة، بس وقتها الرد هيبان مقتبس عندك انت بس مش عند الكل.
        body: JSON.stringify({
          text,
          reply_to: replyTarget
            ? { id: replyTarget.id, name: replyTarget.name, text: replyTarget.text }
            : null,
        }),
      });
      if (data?.comment) {
        // لو السيرفر رجّع reply_to نستخدمه، ولو لأ نكمّل بالنسخة المحلية
        // عشان يبان الاقتباس فورًا عندنا حتى لو الباك إند لسه ماعندوش الميزة
        const comment = { ...data.comment, reply_to: data.comment.reply_to ?? replyTarget };
        setNews(prev =>
          prev.map(n =>
            n.id === newsId
              ? { ...n, comments: [...(n.comments || []), comment] }
              : n
          )
        );
      }
      setCommentText(prev => ({ ...prev, [newsId]: '' }));
      setReplyingTo(prev => ({ ...prev, [newsId]: null }));
    } catch (e) {
      console.warn('handleComment error:', e);
    }
  }

  async function handleVote(newsId: string, optionId: string) {
    try {
      const data = await apiCall(`/news/${newsId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ option_id: optionId }),
      });
      if (data) {
        setNews(prev =>
          prev.map(n =>
            n.id === newsId
              ? {
                  ...n,
                  poll_options: data.poll_options ?? n.poll_options,
                  poll_voters: data.poll_voters ?? n.poll_voters,
                }
              : n
          )
        );
      }
    } catch (e) {
      console.warn('handleVote error:', e);
    }
  }

  async function handleSubmitQuiz(newsId: string, questions: any[]) {
    if (submitting) return;
    const answers = quizAnswers[newsId] || [];

    if (answers.length < questions.length) {
      Alert.alert(
        isArabic ? 'تنبيه' : 'Warning',
        isArabic ? 'أجب على جميع الأسئلة' : 'Please answer all questions'
      );
      return;
    }

    setSubmitting(newsId);
    try {
      const data = await apiCall(`/news/${newsId}/submit-quiz`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      if (data) {
        setNews(prev =>
          prev.map(n =>
            n.id === newsId
              ? { ...n, quiz_submissions: data.submissions ?? n.quiz_submissions }
              : n
          )
        );
        Alert.alert(
          '✅',
          isArabic
            ? `تم الإرسال! نتيجتك: ${data.score ?? '?'}/${questions.length}`
            : `Submitted! Score: ${data.score ?? '?'}/${questions.length}`
        );
      }
    } catch (e) {
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        isArabic ? 'فشل إرسال الإجابات' : 'Failed to submit quiz'
      );
    } finally {
      setSubmitting('');
    }
  }

  async function handleDelete(newsId: string) {
    Alert.alert(
      isArabic ? 'حذف' : 'Delete',
      isArabic ? 'هل تريد حذف هذا المنشور؟' : 'Delete this post?',
      [
        { text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isArabic ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiCall(`/news/${newsId}`, { method: 'DELETE' });
              setNews(prev => prev.filter(n => n.id !== newsId));
            } catch {
              Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'فشل الحذف' : 'Delete failed');
            }
          },
        },
      ]
    );
  }

  async function handleSaveEdit() {
    if (!editItem || !editTitle.trim()) return;
    try {
      const data = await apiCall(`/news/${editItem.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      if (data) {
        setNews(prev =>
          prev.map(n =>
            n.id === editItem.id
              ? { ...n, title: editTitle, content: editContent }
              : n
          )
        );
        setEditModal(false);
        Alert.alert('✅', isArabic ? 'تم التحديث' : 'Updated');
      }
    } catch {
      Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'فشل التحديث' : 'Update failed');
    }
  }

  async function handlePublishResults(newsId: string) {
    try {
      await apiCall(`/news/${newsId}/publish-results`, { method: 'POST' });
      setNews(prev =>
        prev.map(n =>
          n.id === newsId ? { ...n, quiz_results_published: true } : n
        )
      );
      Alert.alert('✅', isArabic ? 'تم نشر النتائج' : 'Results published');
    } catch {
      Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'فشل نشر النتائج' : 'Failed');
    }
  }

  async function handleViewResults(newsId: string) {
    try {
      const data = await apiCall(`/admin/quiz/${newsId}/results`);
      if (data) setQuizResultsModal(data);
    } catch {
      Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'فشل تحميل النتائج' : 'Failed to load results');
    }
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString(
        isArabic ? 'ar-SA' : 'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' }
      );
    } catch {
      return dateStr;
    }
  }

  function getUserReaction(item: NewsItem): string | null {
    if (!user || !item.user_reactions) return null;
    return item.user_reactions[user.id] || null;
  }

  function getTotalReactions(reactions: Record<string, number>): number {
    if (!reactions) return 0;
    return Object.values(reactions).reduce((sum, count) => sum + count, 0);
  }

  function renderPoll(item: NewsItem) {
    const hasVoted = item.poll_voters?.includes(user?.id || '');
    const totalVotes = item.poll_options?.reduce(
      (sum: number, o: any) => sum + (o.votes || 0), 0
    ) || 0;

    return (
      <View style={styles.pollWrap}>
        {item.poll_options?.map((option: any) => {
          const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.pollOption, hasVoted && styles.pollOptionVoted]}
              onPress={() => !hasVoted && handleVote(item.id, option.id)}
              disabled={hasVoted}
            >
              {hasVoted && (
                <View style={[styles.pollBar, { width: `${pct}%` as any }]} />
              )}
              <Text style={styles.pollOptionText}>
                {isArabic && option.text_ar ? option.text_ar : option.text}
              </Text>
              {hasVoted && (
                <Text style={styles.pollPct}>{pct}%</Text>
              )}
            </TouchableOpacity>
          );
        })}
        <Text style={styles.pollTotal}>
          {totalVotes} {isArabic ? 'صوت' : 'votes'}
        </Text>
      </View>
    );
  }

  function renderQuiz(item: NewsItem) {
    const mySubmission = item.quiz_submissions?.find(
      (s: any) => s.user_id === user?.id
    );
    const questions = item.quiz_questions || [];
    const answers = quizAnswers[item.id] || [];

    if (mySubmission) {
      return (
        <View>
          {isAdmin && (
            <View style={styles.quizAdminRow}>
              <TouchableOpacity
                style={styles.quizAdminBtn}
                onPress={() => handleViewResults(item.id)}
              >
                <Ionicons name="bar-chart-outline" size={16} color={Colors.primary} />
                <Text style={styles.quizAdminText}>
                  {isArabic ? 'النتائج' : 'Results'}
                </Text>
              </TouchableOpacity>
              {!item.quiz_results_published && (
                <TouchableOpacity
                  style={styles.quizAdminBtn}
                  onPress={() => handlePublishResults(item.id)}
                >
                  <Ionicons name="eye-outline" size={16} color={Colors.primary} />
                  <Text style={styles.quizAdminText}>
                    {isArabic ? 'نشر النتائج' : 'Publish Results'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {item.quiz_results_published && (
            <View style={styles.quizResult}>
              <Ionicons name="trophy" size={20} color={Colors.success} />
              <Text style={styles.quizScore}>
                {isArabic ? 'نتيجتك:' : 'Score:'}{' '}
                {mySubmission.score}/{questions.length}
              </Text>
            </View>
          )}
          {!item.quiz_results_published && (
            <View style={styles.quizResult}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.quizScore}>
                {isArabic ? 'تم الإرسال، انتظر النتائج' : 'Submitted, waiting for results'}
              </Text>
            </View>
          )}
        </View>
      );
    }

    return (
      <View>
        {isAdmin && (
          <View style={styles.quizAdminRow}>
            <TouchableOpacity
              style={styles.quizAdminBtn}
              onPress={() => handleViewResults(item.id)}
            >
              <Ionicons name="bar-chart-outline" size={16} color={Colors.primary} />
              <Text style={styles.quizAdminText}>
                {isArabic ? 'النتائج' : 'Results'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {questions.map((q: any, qi: number) => (
          <View key={qi} style={styles.quizQuestion}>
            <Text style={styles.quizQuestionText}>
              {qi + 1}. {isArabic && q.text_ar ? q.text_ar : q.text}
            </Text>
            {q.options?.map((opt: any, oi: number) => (
              <TouchableOpacity
                key={oi}
                style={[
                  styles.quizOption,
                  answers[qi] === oi && styles.quizOptionSelected,
                ]}
                onPress={() => {
                  const newAnswers = [...answers];
                  newAnswers[qi] = oi;
                  setQuizAnswers(prev => ({ ...prev, [item.id]: newAnswers }));
                }}
              >
                <View style={[
                  styles.quizRadio,
                  answers[qi] === oi && styles.quizRadioSelected,
                ]} />
                <Text style={styles.quizOptionText}>
                  {isArabic && opt.text_ar ? opt.text_ar : opt.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <TouchableOpacity
          style={styles.submitQuizBtn}
          onPress={() => handleSubmitQuiz(item.id, questions)}
          disabled={submitting === item.id}
        >
          {submitting === item.id ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitQuizText}>
              {isArabic ? 'إرسال الإجابات' : 'Submit Answers'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  function renderNewsItem({ item }: { item: NewsItem }) {
    const title = isArabic && item.title_ar ? item.title_ar : item.title;
    const content = isArabic && item.content_ar ? item.content_ar : item.content;
    const userReaction = getUserReaction(item);
    const totalReactions = getTotalReactions(item.reactions);
    const isExpanded = expandedComments[item.id];
    const visibleComments = isExpanded ? item.comments : item.comments?.slice(0, 2);

    return (
      <View style={styles.card}>

        {/* هيدر البوست */}
        <View style={styles.cardHeader}>
          <View style={styles.authorAvatar}>
            <Ionicons name="person" size={18} color={Colors.primary} />
          </View>
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{item.created_by_name}</Text>
            <Text style={styles.postDate}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {item.type === 'poll'
                ? (isArabic ? 'استطلاع' : 'Poll')
                : item.type === 'quiz'
                ? (isArabic ? 'اختبار' : 'Quiz')
                : (isArabic ? 'خبر' : 'News')}
            </Text>
          </View>
          {isAdmin && (
            <View style={styles.adminBtns}>
              <TouchableOpacity
                onPress={() => {
                  setEditItem(item);
                  setEditTitle(title);
                  setEditContent(content);
                  setEditModal(true);
                }}
              >
                <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* المحتوى */}
        <Text style={styles.postTitle}>{title}</Text>
        {content ? <Text style={styles.postContent}>{content}</Text> : null}

        {/* Poll */}
        {item.type === 'poll' && renderPoll(item)}

        {/* Quiz */}
        {item.type === 'quiz' && renderQuiz(item)}

        {/* الردود */}
        <View style={styles.reactionsRow}>
          <TouchableOpacity
            style={styles.emojiToggleBtn}
            onPress={() => setShowEmojis(showEmojis === item.id ? '' : item.id)}
          >
            <Text style={styles.emojiToggleText}>
              {userReaction || '👍'}
            </Text>
            {totalReactions > 0 && (
              <Text style={styles.reactCount}>{totalReactions}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* لوحة الإيموجي */}
        {showEmojis === item.id && (
          <View style={styles.emojiPanel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {EMOJIS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiBtn,
                    userReaction === emoji && styles.emojiBtnActive,
                  ]}
                  onPress={() => handleReact(item.id, emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* التعليقات - بأسلوب واتساب: فقاعات + إمكانية الرد على رسالة معينة */}
        <View style={styles.commentSection}>
          {visibleComments?.map((c: any, i: number) => {
            const commentId = c.id || `${item.id}-${i}`;
            const isMine = isAdmin && c.user_id === user?.id;
            return (
              <TouchableOpacity
                key={commentId}
                activeOpacity={0.7}
                onLongPress={() => {
                  if (!isAdmin) return; // الرد ميزة للمشرف فقط
                  setReplyingTo(prev => ({
                    ...prev,
                    [item.id]: { id: commentId, name: c.user_name, text: c.text },
                  }));
                }}
                style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}
              >
                <View style={[styles.bubble, isMine && styles.bubbleMine]}>
                  {!isMine && <Text style={styles.commentName}>{c.user_name}</Text>}
                  {c.reply_to && (
                    <View style={styles.quoteBox}>
                      <View style={styles.quoteBar} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.quoteName}>{c.reply_to.name}</Text>
                        <Text style={styles.quoteText} numberOfLines={1}>
                          {c.reply_to.text}
                        </Text>
                      </View>
                    </View>
                  )}
                  <Text style={[styles.commentText, isMine && styles.commentTextMine]}>
                    {c.text}
                  </Text>
                </View>
                {isAdmin && (
                  <TouchableOpacity
                    style={styles.replyIconBtn}
                    onPress={() => setReplyingTo(prev => ({
                      ...prev,
                      [item.id]: { id: commentId, name: c.user_name, text: c.text },
                    }))}
                  >
                    <Ionicons name="arrow-undo-outline" size={15} color={Colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}

          {item.comments?.length > 2 && (
            <TouchableOpacity
              onPress={() => setExpandedComments(prev => ({
                ...prev, [item.id]: !prev[item.id]
              }))}
            >
              <Text style={styles.moreComments}>
                {isExpanded
                  ? (isArabic ? 'عرض أقل' : 'Show less')
                  : (isArabic
                      ? `عرض ${item.comments.length - 2} تعليق أخر`
                      : `View ${item.comments.length - 2} more comments`)
                }
              </Text>
            </TouchableOpacity>
          )}

          {/* شريط الرد (زي واتساب) - بيظهر لما تدوس ضغطة طويلة أو أيقونة الرد على رسالة */}
          {replyingTo[item.id] && (
            <View style={styles.replyPreviewBar}>
              <View style={styles.replyPreviewAccent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.replyPreviewName}>
                  {isArabic ? 'رد على' : 'Replying to'} {replyingTo[item.id]?.name}
                </Text>
                <Text style={styles.replyPreviewText} numberOfLines={1}>
                  {replyingTo[item.id]?.text}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReplyingTo(prev => ({ ...prev, [item.id]: null }))}
                style={styles.replyPreviewClose}
              >
                <Ionicons name="close" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* حقل إضافة تعليق - شريط إرسال بأسلوب واتساب */}
          <View style={styles.commentInput}>
            <TextInput
              style={styles.commentField}
              placeholder={
                replyingTo[item.id]
                  ? (isArabic ? 'اكتب ردك...' : 'Write a reply...')
                  : (isArabic ? 'أضف تعليقاً...' : 'Add a comment...')
              }
              placeholderTextColor={Colors.textSecondary}
              value={commentText[item.id] || ''}
              onChangeText={text =>
                setCommentText(prev => ({ ...prev, [item.id]: text }))
              }
              onSubmitEditing={() => handleComment(item.id)}
              returnKeyType="send"
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                !!commentText[item.id]?.trim() && styles.sendBtnActive,
              ]}
              onPress={() => handleComment(item.id)}
              disabled={!commentText[item.id]?.trim()}
            >
              <Ionicons
                name="send"
                size={17}
                color={commentText[item.id]?.trim() ? '#FFF' : Colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          {isAdmin && !replyingTo[item.id] && (item.comments?.length ?? 0) > 0 && (
            <Text style={styles.replyHint}>
              {isArabic ? 'اضغط مطولاً على أي رسالة للرد عليها' : 'Long-press any message to reply'}
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isAdmin && (
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/admin/create-news')}
        >
          <Ionicons name="add-circle" size={20} color="#FFF" />
          <Text style={styles.createBtnText}>
            {isArabic ? 'إنشاء منشور' : 'Create Post'}
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={news}
        keyExtractor={item => item.id}
        renderItem={renderNewsItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchNews(); }}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="newspaper-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyText}>
              {isArabic ? 'لا توجد أخبار' : 'No posts yet'}
            </Text>
          </View>
        }
      />

      {/* Modal تعديل */}
      <Modal
        visible={editModal}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isArabic ? 'تعديل المنشور' : 'Edit Post'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder={isArabic ? 'العنوان' : 'Title'}
              placeholderTextColor={Colors.textSecondary}
            />
            <TextInput
              style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
              value={editContent}
              onChangeText={setEditContent}
              placeholder={isArabic ? 'المحتوى' : 'Content'}
              placeholderTextColor={Colors.textSecondary}
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditModal(false)}
              >
                <Text style={styles.cancelText}>
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                <Text style={styles.saveText}>
                  {isArabic ? 'حفظ' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal نتائج الكويز */}
      <Modal
        visible={!!quizResultsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setQuizResultsModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isArabic ? 'نتائج الاختبار' : 'Quiz Results'}
            </Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {quizResultsModal?.results?.map((r: any, i: number) => (
                <View key={i} style={styles.resultItem}>
                  <Text style={styles.resultName}>{r.user_name}</Text>
                  <Text style={styles.resultScore}>
                    {r.score}/{r.total}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => setQuizResultsModal(null)}
            >
              <Text style={styles.saveText}>
                {isArabic ? 'إغلاق' : 'Close'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1, justifyContent: 'center',
    alignItems: 'center', backgroundColor: Colors.background,
  },
  createBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primary, margin: 16, marginBottom: 8,
    paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 12, gap: 8, justifyContent: 'center',
  },
  createBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  listContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFF', borderRadius: 16,
    padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12, gap: 8,
  },
  authorAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  authorInfo: { flex: 1 },
  authorName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  postDate: { fontSize: 12, color: Colors.textSecondary },
  typeBadge: {
    backgroundColor: Colors.accent + '20',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.accent },
  adminBtns: { flexDirection: 'row', gap: 12 },
  postTitle: {
    fontSize: 17, fontWeight: '700',
    color: Colors.textPrimary, marginBottom: 6,
  },
  postContent: {
    fontSize: 14, color: Colors.textSecondary,
    lineHeight: 20, marginBottom: 12,
  },
  reactionsRow: { flexDirection: 'row', marginTop: 8, marginBottom: 4 },
  emojiToggleBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20, gap: 4,
  },
  emojiToggleText: { fontSize: 18 },
  reactCount: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  emojiPanel: {
    backgroundColor: '#FFF', borderRadius: 12,
    padding: 8, marginVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  emojiBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 2,
  },
  emojiBtnActive: { backgroundColor: Colors.accent + '20' },
  emojiText: { fontSize: 22 },
  pollWrap: { marginVertical: 8 },
  pollOption: {
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, padding: 14, marginBottom: 8,
    overflow: 'hidden', position: 'relative',
  },
  pollOptionVoted: { borderColor: Colors.accent },
  pollBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: Colors.accent + '20', borderRadius: 12,
  },
  pollOptionText: {
    fontSize: 14, color: Colors.textPrimary,
    fontWeight: '600', zIndex: 1,
  },
  pollPct: {
    position: 'absolute', right: 14, top: 14,
    fontSize: 13, fontWeight: '700', color: Colors.accent,
  },
  pollTotal: {
    fontSize: 12, color: Colors.textSecondary,
    marginTop: 4, textAlign: 'right',
  },
  quizQuestion: { marginBottom: 16 },
  quizQuestionText: {
    fontSize: 15, fontWeight: '700',
    color: Colors.textPrimary, marginBottom: 8,
  },
  quizOption: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 6, gap: 10,
  },
  quizOptionSelected: {
    borderColor: Colors.accent, backgroundColor: Colors.accent + '10',
  },
  quizRadio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: Colors.border,
  },
  quizRadioSelected: {
    borderColor: Colors.accent, backgroundColor: Colors.accent,
  },
  quizOptionText: { fontSize: 14, color: Colors.textPrimary, flex: 1 },
  submitQuizBtn: {
    backgroundColor: Colors.accent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  submitQuizText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  quizResult: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.success + '10',
    padding: 14, borderRadius: 12, marginBottom: 12,
  },
  quizScore: { fontSize: 16, fontWeight: '700', color: Colors.success },
  quizAdminRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  quizAdminBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, backgroundColor: Colors.background, gap: 4,
  },
  quizAdminText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  commentSection: { marginTop: 4, backgroundColor: '#ECE5DD', borderRadius: 14, padding: 10 },
  moreComments: {
    fontSize: 12, color: Colors.accent,
    fontWeight: '600', marginBottom: 8, textAlign: 'center',
  },
  // فقاعات المحادثة بأسلوب واتساب
  bubbleRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    marginBottom: 6, maxWidth: '86%', alignSelf: 'flex-start', gap: 4,
  },
  bubbleRowMine: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubble: {
    backgroundColor: '#FFF', borderRadius: 12, borderTopLeftRadius: 2,
    paddingHorizontal: 10, paddingVertical: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 2, elevation: 1,
  },
  bubbleMine: {
    backgroundColor: '#DCF8C6', borderTopLeftRadius: 12, borderTopRightRadius: 2,
  },
  commentName: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
  commentText: { fontSize: 14, color: Colors.textPrimary },
  commentTextMine: { color: Colors.textPrimary },
  replyIconBtn: { padding: 4 },
  // اقتباس الرسالة المردود عليها، جوه الفقاعة نفسها
  quoteBox: {
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8, padding: 6, marginBottom: 4, gap: 6,
  },
  quoteBar: { width: 3, borderRadius: 2, backgroundColor: Colors.accent },
  quoteName: { fontSize: 11, fontWeight: '700', color: Colors.accent },
  quoteText: { fontSize: 12, color: Colors.textSecondary },
  // شريط "الرد على" اللي بيظهر فوق حقل الكتابة قبل الإرسال
  replyPreviewBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 10,
    padding: 8, marginTop: 8, gap: 8,
  },
  replyPreviewAccent: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: Colors.accent },
  replyPreviewName: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  replyPreviewText: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  replyPreviewClose: { padding: 4 },
  replyHint: {
    fontSize: 11, color: Colors.textSecondary, textAlign: 'center', marginTop: 6,
  },
  commentInput: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: '#F9F9F9', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, minHeight: 46,
    marginTop: 8, borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)', gap: 8,
  },
  commentField: { flex: 1, fontSize: 14, color: Colors.textPrimary, maxHeight: 100, paddingVertical: 6 },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent', marginBottom: 2,
  },
  sendBtnActive: { backgroundColor: Colors.accent },
  emptyText: {
    fontSize: 16, color: Colors.textSecondary,
    marginTop: 12, fontWeight: '600',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', padding: 24,
  },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 24 },
  modalTitle: {
    fontSize: 20, fontWeight: '700',
    color: Colors.textPrimary, marginBottom: 16,
  },
  modalInput: {
    backgroundColor: Colors.background, borderWidth: 1,
    borderColor: Colors.border, borderRadius: 12,
    padding: 14, fontSize: 15, color: Colors.textPrimary, marginBottom: 12,
  },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  saveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  resultItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  resultName: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  resultScore: { fontSize: 14, color: Colors.accent, fontWeight: '700' },
});
