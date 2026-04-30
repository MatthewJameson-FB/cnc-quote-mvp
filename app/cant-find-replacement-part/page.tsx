import SeoLandingPage from '@/app/components/SeoLandingPage'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <SeoLandingPage
      title="Can’t find a replacement part anywhere?"
      intro="Upload a photo and description. If the part is discontinued or out of stock everywhere, we’ll help you find a path to a usable replacement."
      examples={[
        'Manufacturer doesn’t sell the part any more and the item is unusable without it.',
        'You’ve searched everywhere and still can’t find a matching clip, latch or cover.',
        'A broken part is stopping a tool, vehicle or appliance from working properly.',
      ]}
    />
  )
}
