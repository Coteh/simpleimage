#!/bin/sh

node_dev_server="nodemon"

echo "" > output.log
mongod -f mongodb.conf 2>> err.log >> output.log &
npm run dev-server 2>> err.log >> output.log &
npm run build-client 2>> err.log >> output.log &

clean_up() {
    # kill because it's detached from this process
    pkill -TERM mongod
}

signal_handler() {
    clean_up
    exit
}

hup_handler() {
    clean_up
    # kill these because they spawn nodemon and webpack
    # child processes respectively (SIGHUP signal doesn't kill them)
    kill -INT $server_pid $client_pid
    exit
}

trap signal_handler SIGINT SIGQUIT
trap hup_handler SIGHUP

echo "Starting db, server, and client builder..."

sleep 5

echo "db: " '\t\t' $(pgrep mongo)

server_pid="$(ps -ef | grep $node_dev_server | grep -v grep | awk '{print $2}')"
client_pid=$(ps -ef | grep webpack | grep -v grep | awk '{print $2}')

echo "server: " '\t' $server_pid
echo "client: " '\t' $client_pid

wait