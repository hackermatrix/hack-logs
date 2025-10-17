# Blue Team: Web Log Pipeline in a Weekend

From raw Nginx to Kibana dashboards with ELK.

## Architecture

```
Nginx -> Filebeat -> Logstash -> Elasticsearch -> Kibana
```

## Nginx access log

```nginx
log_format json escape=json '{"time":"$time_iso8601","remote":"$remote_addr","host":"$host","method":"$request_method","uri":"$request_uri","status":$status,"ua":"$http_user_agent","ref":"$http_referer","bytes":$bytes_sent,"rt":$request_time}';
access_log /var/log/nginx/access.json json;
```

## Filebeat

```yaml
filebeat.inputs:
  - type: filestream
    id: nginx-json
    paths: [/var/log/nginx/access.json]

output.logstash:
  hosts: ["localhost:5044"]
```

## Logstash pipeline

```conf
input { beats { port => 5044 } }
filter {
  json { source => "message" }
  date { match => ["time", "ISO8601"] }
}
output {
  elasticsearch { hosts => ["http://localhost:9200"] index => "nginx-%{+YYYY.MM.dd}" }
}
```

## Kibana

- Create index pattern `nginx-*`
- Visualize `status`, `rt`, top `uri`

Ship it, then iterate.
