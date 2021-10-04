require 'test/unit'
include Test::Unit::Assertions

step '<key> is loaded' do |key|
  assert_not_nil(ENV[key])
end

step '<key> is not loaded' do |key|
  assert_nil(ENV[key])
end
