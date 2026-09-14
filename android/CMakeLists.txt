project(OsukiSplash)
cmake_minimum_required(VERSION 3.9.0)

set(PACKAGE_NAME OsukiSplash)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

# Only the JNI bridge nitrogen generates; the implementation is Kotlin.
add_library(${PACKAGE_NAME} SHARED
        src/main/cpp/cpp-adapter.cpp
)

include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/OsukiSplash+autolinking.cmake)

include_directories(
        "src/main/cpp"
)

find_library(LOG_LIB log)

target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        android
)
