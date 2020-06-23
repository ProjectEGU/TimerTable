# Timetable Arrangement utility
> A tool to arrange courses into a timetable automatically. Supports different preferences such as morning/evening course load, and short/long days. Currently supports UTM and St. George campuses. 
# Online tool
[Click here to use the tool](https://projectegu.github.io/TimerTable/)

## Current Todos
- [ ] Serve course data as a gzipped file with appropriate headers
- [ ] Serve course data with proper caching headers
- [ ] Scrape additional information: prerequisites, corequisites, exclusions, and delivery mode
- [ ] Implement fuzzy searching by course code and course name
- [ ] Rework timetable display to use flex layout for better performance
- [ ] Polish gaps and spacing in the current GUI

## Lower Priority Goals
- [ ] Choose which sections to include in search
- [ ] Block off times on the timetable

## Longer term goals
- [ ] Refactor using Redux for cleaner code
- [ ] Run the algorithm using WebWorkers so that the GUI thread isn't blocked during computation
- [ ] When a timetable can't be made, find out which courses to remove  (very hard!)


# See also
* [React Webpack Typescript Starter](https://github.com/vikpe/react-webpack-typescript-starter)
* [Ant Design](https://ant.design/docs/react/introduce)
* [An algorithm to solve the Course Scheduling problem](https://github.com/ProjectEGU/Course-Scheduling-Algorithm/blob/master/ExactCover.md)