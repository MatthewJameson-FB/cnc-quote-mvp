import SeoLandingPage from '@/app/components/SeoLandingPage'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <SeoLandingPage
      title="Replacement car parts in the UK"
      intro="Can’t find a replacement car part anywhere? Upload a photo and we’ll help recreate the piece that’s holding the job up."
      examples={[
        'Car interior clip broke and the trim no longer sits right.',
        'Plastic handle snapped off and the door or panel no longer works properly.',
        'A small bracket or cover is discontinued and the manufacturer no longer sells it.',
      ]}
    />
  )
}
