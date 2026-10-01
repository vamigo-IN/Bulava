import type { Catalog } from './en';

/** Hinglish (Hindi in Latin script). Falls back to English. */
export const hiLatn: Catalog = {
  'invitation.welcome': 'Swagat hai',
  'invitation.dear': 'Priya {guestName},',
  'invitation.youAreInvited': 'Aap saadar aamantrit hain',
  'invitation.wedding': 'Shaadi',
  'invitation.venue': 'Venue',
  'invitation.yourFunctions': 'Aapke invitation mein shaamil hai',
  'invitation.whatsappMessage': 'Priya {guestName}, {eventTitle} mein aap saadar aamantrit hain. Apna invitation kholiye: {url}',
  'rsvp.title': 'Kya aap aayenge?',
  'rsvp.attending': 'Haan, main aaunga/aaungi',
  'rsvp.declined': 'Maaf kijiye, nahi aa paunga/paungi',
  'rsvp.maybe': 'Shayad',
  'rsvp.attendeeCount': 'Kitne log aayenge',
  'rsvp.submit': 'RSVP bhejein',
  'rsvp.update': 'RSVP badlein',
  'rsvp.thanks': 'Dhanyavaad! Aapka jawab save ho gaya hai.',

  'event.linkExpired.title': 'Yeh link expire ho gaya hai',
  'event.linkExpired.body': 'Naye invitation link ke liye apne host se poochhiye.',
  'event.linkInvalid.title': 'Yeh link ab valid nahin hai',
  'event.linkInvalid.body': 'Ho sakta hai host ne ise badal diya ho. Naya link unse maangiye.',
  'share.whatsappMessage': '{eventTitle}\n\nAap saadar aamantrit hain! Invitation kholiye: {url}',
  'upload.album': 'Yeh photos kis function ki hain?',
  'gallery.all': 'Sabhi',
  'error.EVENT_LINK_EXPIRED': 'Yeh invitation link expire ho gaya hai. Naye link ke liye apne host se poochhiye.',
};
