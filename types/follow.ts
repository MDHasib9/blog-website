export type FollowRow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type FollowProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};
