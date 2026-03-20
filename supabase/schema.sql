-- =============================================
-- WBS Manager - Supabase Schema
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. PROFILES (회원 정보)
CREATE TABLE IF NOT EXISTS public.profiles (
  id      UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name    TEXT NOT NULL DEFAULT '',
  email   TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 가입 시 자동으로 profile 생성하는 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. PROJECTS (프로젝트)
CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_date  DATE,
  end_date    DATE,
  owner_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (
  owner_id = auth.uid() OR
  id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND status IN ('accepted', 'pending'))
);
CREATE POLICY "projects_insert" ON public.projects FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "projects_update" ON public.projects FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "projects_delete" ON public.projects FOR DELETE USING (owner_id = auth.uid());

-- 3. PROJECT_MEMBERS (프로젝트 초대 / 멤버)
CREATE TABLE IF NOT EXISTS public.project_members (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role        TEXT DEFAULT 'member',
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  invited_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_members_select" ON public.project_members FOR SELECT USING (
  user_id = auth.uid() OR
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);
CREATE POLICY "project_members_insert" ON public.project_members FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);
CREATE POLICY "project_members_update" ON public.project_members FOR UPDATE USING (
  user_id = auth.uid() OR
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);
CREATE POLICY "project_members_delete" ON public.project_members FOR DELETE USING (
  user_id = auth.uid() OR
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);

-- 4. TEAM_MEMBERS (프로젝트 내 담당자 - WBS 어사인용)
CREATE TABLE IF NOT EXISTS public.team_members (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'FE',
  email      TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_access" ON public.team_members FOR ALL USING (
  project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND status = 'accepted'
  )
);

-- 5. TASKS (WBS 작업)
CREATE TABLE IF NOT EXISTS public.tasks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  parent_id   UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status      TEXT DEFAULT 'todo',
  priority    TEXT DEFAULT 'medium',
  start_date  DATE,
  end_date    DATE,
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_access" ON public.tasks FOR ALL USING (
  project_id IN (
    SELECT id FROM public.projects WHERE owner_id = auth.uid()
    UNION
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND status = 'accepted'
  )
);

-- =============================================
-- MIGRATION: tasks 테이블에 링크 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- =============================================
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS jira_url TEXT DEFAULT '';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deliverable_url TEXT DEFAULT '';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deliverable_image TEXT DEFAULT '';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS screen_ref TEXT DEFAULT '';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS screen_name TEXT DEFAULT '';

-- 6. FRIENDSHIPS (친구 관계)
CREATE TABLE IF NOT EXISTS public.friendships (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  addressee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships_select" ON public.friendships FOR SELECT USING (
  requester_id = auth.uid() OR addressee_id = auth.uid()
);
CREATE POLICY "friendships_insert" ON public.friendships FOR INSERT WITH CHECK (
  requester_id = auth.uid()
);
CREATE POLICY "friendships_update" ON public.friendships FOR UPDATE USING (
  addressee_id = auth.uid() OR requester_id = auth.uid()
);
CREATE POLICY "friendships_delete" ON public.friendships FOR DELETE USING (
  requester_id = auth.uid() OR addressee_id = auth.uid()
);
