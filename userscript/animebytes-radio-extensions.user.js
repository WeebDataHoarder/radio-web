// ==UserScript==
// @name        anime(bits) extension for AnimeBytes
// @namespace   animebits.radio.extension.animebytes
// @author      anime(bits)
// @description Adds group radio links on AnimeBytes to artists, series, collages listings, and direct links to each torrent group on related lists as well.
// @version     1.3.2
// @homepage    https://radio.animebits.moe
// @icon        https://radio.animebits.moe/img/icon-128.png
// @updateURL   https://radio.animebits.moe/userscript/animebytes-radio-extensions.user.js
// @downloadURL https://radio.animebits.moe/userscript/animebytes-radio-extensions.user.js
//
// @run-at      document-end
// @include     https://animebytes.tv/torrents2.php*
// @include     https://animebytes.tv/artist.php?*
// @include     https://animebytes.tv/collage.php?*
// @include     https://animebytes.tv/series.php?*
// @include     https://animebytes.tv/torrents.php?*
// @include     https://animebytes.tv/forums.php?*
// ==/UserScript==

function addToGroupExtraLinks(element){
    try{
        let thinElement = document.getElementById("content").getElementsByClassName("thin")[0];
        let h2 = thinElement.getElementsByTagName("h2")[0];

        let h3 = h2.nextElementSibling;
        if(h3.nodeName.toLowerCase() !== "h3"){
            h3 = document.createElement("h3");
            h2.parentNode.insertBefore(h3, h2.nextSibling);
        }
        if(h3.childNodes.length > 0){
            h3.append(" | ");
        }
        h3.append(element);
        return true;
    }catch (e) {
        //No elements to add onto
        return false;
    }
}

function addToListRadioLinks(groupList, allowSingleTorrents = false, inline = false){
    for(let i = 0; i < groupList.length; ++i){
        try{
            let list = groupList[i].getElementsByTagName("a");
            for(let j = 0; j < list.length; ++j){
                let link = new URL(list[j].href, document.location.origin);
                if((allowSingleTorrents || !link.searchParams.has("torrentid")) && list[j].getElementsByTagName("img").length === 0){
                   let extraElement = getGroupRadioLink(link);
                   if(extraElement !== null){
                       if(inline){
                           list[j].parentNode.insertBefore(document.createTextNode(" "), list[j].nextSibling);
                           list[j].parentNode.insertBefore(extraElement, list[j].nextSibling.nextSibling);
                       }else{
                           list[j].parentNode.append(" ");
                           list[j].parentNode.append(extraElement);
                       }
                   }
                }
            }
        }catch (e) {
            //No elements to add into
        }
    }
}

function getGroupRadioLink(url){
    if((url.hostname === "animebytes.tv" || url.hostname === "animebyt.es") && url.pathname === "/torrents2.php" && url.searchParams.has("id")){
        const e = document.createElement("a");
        if(url.searchParams.has("torrentid")){
            const id = url.searchParams.get("torrentid");
            const groupId = url.searchParams.get("id");
            e.setAttribute("href", "https://radio.animebits.moe/player/abt/" + parseInt(id) + "/abg/" + parseInt(groupId));
            e.setAttribute("title", "Open anime(bits) release player");
            e.textContent = "\uD83D\uDCFB";
            return e;
        }else{
            const id = url.searchParams.get("id");
            e.setAttribute("href", "https://radio.animebits.moe/player/abg/" + parseInt(id));
            e.setAttribute("title", "Open anime(bits) group player");
            e.textContent = "\uD83D\uDCFB";
            return e;
        }
    }
    return null;
}
function extraEncodeURIComponent(str) {
    return encodeURIComponent(str).replace(/[\(\)]/g, function(c) {
        return '%' + c.charCodeAt(0).toString(16);
    });
}
function escapeSearchParameter(str){
    return str.replace(/(["'])/g, "\\$1");
}
function getSearchRadioLink(searchQueries){
    const e = document.createElement("a");
    let searchQuery = "";
    for(let i in searchQueries){
        if(i > 0){
            searchQuery += "/";
        }
        searchQuery += extraEncodeURIComponent(searchQueries[i]);
    }
    e.setAttribute("href", "https://radio.animebits.moe/player/search/" + searchQuery);
    e.setAttribute("title", "Open anime(bits) search player for: "+searchQuery);
    e.textContent = "[search \uD83D\uDCFB]";
    return e;
}
function reverseWords(str){
    let words = str.split(" ").reverse();
    let reverse = "";
    for(let w in words){
        reverse += (w > 0 ? " " : "") + words[w];
    }

    return reverse;
}


let pageURL = new URL(document.location);

{

    let baseElement = getGroupRadioLink(pageURL);
    if(baseElement !== null){
        addToGroupExtraLinks(baseElement);
    }
}

{
    if(pageURL.pathname === "/collage.php"){
        {
            addToListRadioLinks(document.getElementById("content").getElementsByClassName("discog"), false);
        }
    }
}

{
    if(pageURL.pathname === "/series.php" && pageURL.searchParams.has("id")){
        {
            const e = document.createElement("a");
            const id = pageURL.searchParams.get("id");
            e.setAttribute("href", "https://radio.animebits.moe/player/abs/" + parseInt(id));
            e.setAttribute("title", "Open anime(bits) series player");
            e.textContent = "\uD83D\uDCFB";
            addToGroupExtraLinks(e);
        }

        {
            addToListRadioLinks(document.getElementById("content").getElementsByClassName("discog"), false);
        }
    }
}

{
    if(pageURL.pathname === "/artist.php" && pageURL.searchParams.has("id")){
        let mainArtist = "";
        let secondaryArtist = "";
        {
            let h2 = document.getElementById("content").getElementsByTagName("h2")[0];
            mainArtist = h2.textContent;
            secondaryArtist = h2.nextElementSibling.nodeName.toLowerCase() === "h3" ? h2.nextElementSibling.textContent : "";
        }

        {
            const e = document.createElement("a");
            const id = pageURL.searchParams.get("id");
            e.setAttribute("href", "https://radio.animebits.moe/player/aba/" + parseInt(id));
            e.setAttribute("title", "Open anime(bits) artist player");
            e.textContent = "\uD83D\uDCFB";
            addToGroupExtraLinks(e);
        }

        {
            addToListRadioLinks(document.getElementById("content").getElementsByClassName("discog"), false);
        }

        {
            let query = "artist='"+escapeSearchParameter(mainArtist)+"'";
            if(reverseWords(mainArtist) !== mainArtist){
                query += "OR artist='"+escapeSearchParameter(reverseWords(mainArtist))+"'";
            }
            if(secondaryArtist !== ""){
                query += " OR artist=\'"+escapeSearchParameter(secondaryArtist)+"\'";
                if(reverseWords(secondaryArtist) !== secondaryArtist){
                    query += " OR artist=\'"+escapeSearchParameter(reverseWords(secondaryArtist))+"\'";
                }
            }
            let e = getSearchRadioLink([query]);
            addToGroupExtraLinks(e);
        }

    }
}

{
    if(pageURL.pathname === "/torrents.php" && pageURL.searchParams.has("id")){
        {
            try{
                let list = document.getElementById("song_table").getElementsByTagName("tr");
                for(let i = 0; i < list.length; ++i){
                    if(list[i].className !== "column_head"){
                        let elements = list[i].getElementsByTagName("td");

                        let exactArtist = null;
                        let artists = [];
                        for(let j = 0; j < elements[2].childNodes.length; ++j){
                            if(elements[2].childNodes[j].nodeName === "#text"){
                                let a_l = elements[2].childNodes[j].textContent.split(",");
                                for(let a in a_l){
                                    if(a_l[a].trim() !== ""){
                                        artists.push(a_l[a].trim());
                                    }
                                }
                            }else if(elements[2].childNodes[j].nodeName.toLowerCase() === "a"){
                                artists.push(elements[2].childNodes[j].textContent.trim());
                                let url = (new URL(elements[2].childNodes[j].href, location.origin));
                                if(url.pathname === "/artist.php"){
                                    exactArtist = parseInt(url.searchParams.get("id"));
                                }
                            }
                        }

                        let titles = [];
                        for(let j = 0; j < elements[1].childNodes.length; ++j){
                            if(elements[1].childNodes[j].nodeName === "#text" && elements[1].childNodes[j].textContent.trim() !== ""){
                                titles.push(elements[1].childNodes[j].textContent.trim());
                            }
                        }

                        let titleQuery = "";
                        let artistQuery = "";

                        let titleFuzzyQuery = "";
                        let artistFuzzyQuery = "";

                        for(let j in titles){
                            titleQuery += (j == 0 ? "" : " OR ") + "title=\'"+escapeSearchParameter(titles[j])+"\'";
                            titleFuzzyQuery += (j == 0 ? "" : " OR ") + "title~\'"+escapeSearchParameter(titles[j])+"\'";
                        }

                        titleQuery = "("+titleQuery+")";
                        titleFuzzyQuery = "("+titleFuzzyQuery+")";

                        if(artists.length > 0){
                            for(let j in artists){
                                artistQuery += (j == 0 ? "" : " OR ") + "artist=\'"+escapeSearchParameter(artists[j])+"\'";
                                artistFuzzyQuery += (j == 0 ? "" : " OR ") + "artist~\'"+escapeSearchParameter(artists[j])+"\'";
                                if(reverseWords(artists[j]) !== artists[j]){
                                    artistQuery += " OR artist=\'"+escapeSearchParameter(reverseWords(artists[j]))+"\'";
                                    artistFuzzyQuery += " OR artist~\'"+escapeSearchParameter(reverseWords(artists[j]))+"\'";
                                }
                            }

                            artistQuery = "("+artistQuery+")";
                            artistFuzzyQuery = "("+artistFuzzyQuery+")";
                        }


                        let q = [];

                        {
                            if(exactArtist !== null){
                                q.push("(" + titleQuery + " AND tag:aba-" + exactArtist + " AND path=\'%.flac\')");
                            }

                            if(artistQuery !== ""){
                                q.push("("+titleQuery+" AND "+artistQuery+" AND path=\'%.flac\')");
                            }else{
                                q.push("("+titleQuery+" AND path=\'%.flac\')");
                            }
                        }

                        {
                            if(exactArtist !== null){
                                q.push("(" + titleQuery + " AND tag:aba-" + exactArtist + ")");
                            }

                            if(artistQuery !== ""){
                                q.push("("+titleQuery+" AND "+artistQuery+")");
                            }else{
                                q.push("("+titleQuery+")");
                            }
                        }

                        {
                            if(exactArtist !== null){
                                q.push("(" + titleFuzzyQuery + " AND tag:aba-" + exactArtist + ")");
                            }

                            if(artistQuery !== ""){
                                q.push("("+titleQuery+" AND "+artistFuzzyQuery+")");
                                q.push("("+titleFuzzyQuery+" AND "+artistQuery+")");
                                q.push("("+titleFuzzyQuery+" AND "+artistFuzzyQuery+")");
                            }else{
                                q.push("("+titleFuzzyQuery+")");
                            }
                        }

                        let e = getSearchRadioLink(q);
                        let br = document.createElement("br");
                        elements[1].insertBefore(br, elements[1][elements[1].childNodes.length - 1]);
                        elements[1].insertBefore(e, elements[1][elements[1].childNodes.length - 1]);
                    }
                }
            }catch (e) {

            }
        }
    }
}

{
    if(pageURL.pathname === "/torrents2.php" && !pageURL.searchParams.has("id")){
        {
            addToListRadioLinks(document.getElementById("content").getElementsByClassName("group_cont"), false);
        }
    }
}

{
    if(pageURL.pathname === "/forums.php" && pageURL.searchParams.get("action") === "viewthread" && pageURL.searchParams.has("threadid")){
        {
            addToListRadioLinks(document.getElementById("content").getElementsByClassName("post_block"), true, true);
        }
    }
}