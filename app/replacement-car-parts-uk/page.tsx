import SeoLandingPage from '@/app/components/SeoLandingPage'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <SeoLandingPage
      title="Replacement car parts in the UK"
      intro="Can’t find a replacement car part anywhere? Upload a photo — we help recreate hard-to-find trim, clips, covers, brackets and fittings."
      examples={[
        'Interior trim clip broke and the panel no longer sits right.',
        'Dashboard cover or mirror casing is missing and the car looks unfinished.',
        'A small bracket, clip or fitting is discontinued and the manufacturer no longer sells it.',
      ]}
    />
  )
}
