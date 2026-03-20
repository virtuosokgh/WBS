import StoryboardApp from '../storyboard/StoryboardApp'

export default function StoryboardView({ projectId, initialScreenId, canEdit }) {
  return <StoryboardApp projectId={projectId} initialScreenId={initialScreenId} canEdit={canEdit} />
}
