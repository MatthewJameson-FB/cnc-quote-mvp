import SeoLandingPage from '@/app/components/SeoLandingPage'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <SeoLandingPage
      title="Replacement car parts in the UK"
      intro="Can’t find a replacement car part anywhere? Upload a photo and we’ll help with hard-to-find trim, clips, covers, brackets and fittings."
      examples={[
        'A trim clip snapped and the panel no longer sits properly.',
        'A small cover or bracket is discontinued and no dealer sells it separately.',
        'A mirror cover or bumper trim piece is missing after repair work.',
      ]}
    />
  )
}
