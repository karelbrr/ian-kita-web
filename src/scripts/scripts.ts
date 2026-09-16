import Soundcloud from "soundcloud.ts/soundcloud.ts";
import type {SoundcloudTrack, SoundcloudUser} from "soundcloud.ts";

const sc = new Soundcloud();

async function fetchTracks() {
    const user: SoundcloudUser = await sc.users.get("https://soundcloud.com/iankitadj");
    const tracks: SoundcloudTrack[] = (await sc.users.tracks(user.id)).slice(0, 5);

    for (const track of tracks) {
        console.log(track.title);
        console.log(track.artwork_url);
    }
}

fetchTracks();