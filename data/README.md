# Course Data Scrapper

For Developers who want to host the project in their websites. The data must be generated before the scheduler can be used. The scraper will generate `data/course_data_<campus_name>_<session_id>` which is used by the application. Both summer and fall/winter session data must be generated for the application to work.

***

**USAGE:** `python3 scrape_all.py [session_id] [campus]`

* `[session_id]` is the year + 9 for fall/winter and 5 for summer courses
  e.g. 20199 is 2019 fall/winter, while 20195 is 2019 summer.

* `[campuses]` is either nothing or one or more of the supported campuses:
  UTM, STG_ARTSCI
  * To scrape all campuses, don't pass in any value for [campus].
    **Example command:** `scrape_all.py 20199`
    **Example command 2:** `scrape_all.py 20199 UTM STG_ARTSCI`

* To reparse already existing data, pass in 'local' as an argument.

***

**Dependencies:**

* python3
* jsonpickle
  * To install: `pip3 install jsonpickle` 
* lxml
  * To install: `pip3 install lxml`

