#!/bin/bash

API_URL="https://radio.animebits.moe/api/"
API_TOKEN="${API_TOKEN:-YOUR_API_TOKEN_HERE}"
KEEP_ORIGINAL_NAME="0"
ORDER_BY="score"
ORDER_DIRECTION="desc"
if [ -z "${DOWNLOAD_PATH}" ]; then
    DOWNLOAD_PATH='.'
fi

FORMAT_BOLD="\e[1m"
FORMAT_UNDERLINE="\e[4m"
FORMAT_RESET="\e[0m"
FORMAT_COLOR_DEFAULT="\e[39m"
FORMAT_COLOR_BLACK="\e[30m"
FORMAT_COLOR_RED="\e[31m"
FORMAT_COLOR_GREEN="\e[32m"
FORMAT_COLOR_YELLOW="\e[33m"

FORMAT_COLOR_GRAY="\e[37m"
VERSIONED_AGENT="radio-downloader/1.1"

function searchApi() {
  curl "${API_URL}search" --get --user-agent "${VERSIONED_AGENT}" --header "Authorization: ${API_TOKEN}" --fail --silent --data-urlencode "q=${1}" --data-urlencode "limit=500" --data-urlencode "orderBy=${ORDER_BY}" --data-urlencode "orderDirection=${ORDER_DIRECTION}"
}

function fetchSong() {
  if ! [ -f "${2}" ]; then
    curl "${API_URL}download/${1}" --get --location --user-agent "${VERSIONED_AGENT}" --header "Authorization: ${API_TOKEN}" --fail --progress-bar > "${2}"
  fi
}

function downloadItem() {
  # echo -e "${FORMAT_BOLD}${FORMAT_COLOR_GRAY}* Downloading ${1}. $(jq -r '.artist' <<< ""${2}"")${FORMAT_RESET} - ${FORMAT_BOLD}${FORMAT_COLOR_YELLOW}$(jq -r '.title' <<< ""${2}"")${FORMAT_RESET}\t($(jq -r '.album' <<< ""${2}""))"
  originalFilePath="$(jq -r '.path' <<< ""${2}"")"
  if [[ "${KEEP_ORIGINAL_NAME}" == "1" ]]; then
    filepath="${DOWNLOAD_PATH}/"
    filename="${originalFilePath##*/}"
  else
    filepath="${DOWNLOAD_PATH}/$(jq -r '.album' <<< ""${2}"")/"
    filename="$(jq -r '.artist' <<< ""${2}"") - $(jq -r '.title' <<< ""${2}"").${originalFilePath##*.}"
  fi
  mkdir --parents "${filepath}" 2>/dev/null
  echo -e "${FORMAT_BOLD}${FORMAT_COLOR_GRAY}* Downloading ${1}: ${FORMAT_RESET}${filepath}${filename}${FORMAT_RESET}"
  fetchSong "$(jq -r '.hash' <<< ""${2}"")" "${filepath}${filename}"
}

echo -e "${FORMAT_BOLD}${FORMAT_COLOR_RED}=>${FORMAT_COLOR_DEFAULT} Searching:${FORMAT_RESET} $*"

declare -a items
index=1
while IFS= read -r item; do
  echo -n -e "${FORMAT_BOLD}${FORMAT_COLOR_RED}${index}. $(jq -r '.artist' <<< ""${item}"")${FORMAT_RESET} - ${FORMAT_BOLD}${FORMAT_COLOR_YELLOW}$(jq -r '.title' <<< ""${item}"")${FORMAT_RESET}\t($(jq -r '.album' <<< ""${item}""))"
  fav_count=$(jq '.favored_by | length' <<< "${item}")
  if [[ "${fav_count}" -gt "0" ]]; then
    echo -n -e "${FORMAT_RESET}${FORMAT_BOLD}${FORMAT_COLOR_RED} ❤ ${fav_count}"
  fi
  echo
  items[$index]="${item}"
  index=$((index + 1))
done < <(searchApi "$*" | jq -c '.[]')

if [[ "${index}" == "1" ]]; then
  echo -e "${FORMAT_BOLD}${FORMAT_COLOR_RED}No results.${FORMAT_RESET}"
  exit 0
fi

echo -e -n "${FORMAT_BOLD}${FORMAT_COLOR_RED}=>${FORMAT_COLOR_DEFAULT} Which tracks to download? ${FORMAT_RESET}(ex.: 1-3,7): "
read tracks

if [[ "${tracks}" == "" ]]; then
  echo -e "${FORMAT_BOLD}${FORMAT_COLOR_RED}Nothing to do.${FORMAT_RESET}"
  exit 0
fi

currentNumber=""
startNumber=""

for (( i=0; i<${#tracks}; i++ )); do
  character="${tracks:$i:1}"
  case "${character}" in
    [0-9]*)
      currentNumber="${currentNumber}${character}"
      ;;
    ",")
      if [[ "${currentNumber}" != "" ]]; then
        if [[ "${startNumber}" == "" ]]; then
          # Download not a list
          startNumber="${currentNumber}"
        fi
        for dlIndex in $(seq "${startNumber}" 1 "${currentNumber}"); do
          item="${items[dlIndex]}"
          downloadItem "${dlIndex}" "${item}"
        done
        currentNumber=""
        startNumber=""
      fi
      ;;
    "-")
      startNumber="${currentNumber}"
      currentNumber=""
      ;;
    esac
done

if [[ "${currentNumber}" != "" ]]; then
  if [[ "${startNumber}" == "" ]]; then
    # Download not a list
    startNumber="${currentNumber}"
  fi
  for dlIndex in $(seq "${startNumber}" 1 "${currentNumber}"); do
    item="${items[dlIndex]}"
    downloadItem "${dlIndex}" "${item}"
  done
fi
currentNumber=""
startNumber=""

echo -e "${FORMAT_BOLD}${FORMAT_COLOR_RED} => ${FORMAT_RESET}${FORMAT_BOLD}Done!${FORMAT_RESET}"
