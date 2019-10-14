from scrape_courses_utm import scrape_utm
from scrape_courses_stg import scrape_stg_artsci
from datetime import datetime
import sys

if (len(sys.argv) == 1):
    print("scrape_all.py [session_id] [campus]")
    print("[session_id] is the year + 9 for fall/winter and 5 for summer courses")
    print("e.g. 20199 is 2019 fall/winter, while 20195 is 2019 summer.")
    print("")
    print("[campuses] is either nothing or one or more of the supported campuses:")
    print("UTM, STG_ARTSCI")
    print("To scrape all campuses, don't pass in any value for [campus].")
    print("Example command: scrape_all.py 20199")
    print("Example command 2: scrape_all.py 20199 UTM STG_ARTSCI")
    print("")
    print("To reparse already existing data, pass in 'local' as an argument.")
    exit()

session = sys.argv[1]

rest_args = set(x.lower() for x in sys.argv[2:])

ALL = len(rest_args) == 0

UTM = 'utm' in rest_args
STG_ARTSCI = 'stg_artsci' in rest_args

LOCAL = 'local' in rest_args

has_scraped = False

if ALL or UTM:
    print("--- scrape utm courses ---")
    scrape_utm(session, LOCAL)
    has_scraped = True

if ALL or STG_ARTSCI:
    print("--- scrape stg artsci courses ---")
    scrape_stg_artsci(session, LOCAL)
    has_scraped = True

if has_scraped:
    with open("crs_data_last_updated.txt", "w") as f:
        f.write(datetime.now().strftime('%Y %m %d %H:%M:%S'))
